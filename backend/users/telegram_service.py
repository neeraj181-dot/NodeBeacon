"""Private, owner-scoped Telegram Bot API pairing and alert delivery."""
import hashlib
import logging
import secrets
from datetime import timedelta

import requests
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from django.contrib.auth import get_user_model
from users.models import TelegramBotCursor, TelegramPairing

User = get_user_model()

logger = logging.getLogger(__name__)
PAIRING_LIFETIME = timedelta(minutes=10)
API_ROOT = 'https://api.telegram.org'


class TelegramServiceError(Exception):
    pass


def telegram_is_configured():
    configured = bool(getattr(settings, 'TELEGRAM_BOT_TOKEN', '').strip())
    logger.info('[Telegram] Configuration loaded: %s', 'YES' if configured else 'NO')
    return configured


def development_test_chat_id():
    """Return the fixed recipient only for local development test messages."""
    if not getattr(settings, 'DEBUG', False):
        return ''
    return str(getattr(settings, 'TELEGRAM_CHAT_ID', '') or '').strip()


def bot_information():
    """Return only public bot display data; never return Telegram's numeric ID."""
    bot = _api('getMe')
    username = bot.get('username') if isinstance(bot, dict) else None
    if not isinstance(username, str) or not username or not username.isascii() or not all(
        character.isalnum() or character == '_' for character in username
    ):
        raise TelegramServiceError('Telegram did not return a valid bot username.')
    name_parts = [bot.get('first_name'), bot.get('last_name')]
    bot_name = ' '.join(part.strip() for part in name_parts if isinstance(part, str) and part.strip())
    return {
        'bot_name': bot_name or username,
        'bot_username': username,
        'bot_url': f'https://t.me/{username}',
    }


def _api(method, payload=None):
    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '').strip()
    if not token:
        telegram_is_configured()
        raise TelegramServiceError('Telegram is not configured on the NodeBeacon backend.')
    telegram_is_configured()
    try:
        response = requests.post(
            f'{API_ROOT}/bot{token}/{method}', json=payload or {},
            timeout=(4, 10), allow_redirects=False,
        )
        response.raise_for_status()
        result = response.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning('[Telegram] Telegram API response: error (%s).', type(exc).__name__)
        raise TelegramServiceError('Could not reach Telegram. Check backend internet access and bot configuration.') from None
    if not isinstance(result, dict) or result.get('ok') is not True:
        logger.warning('[Telegram] Telegram API response: error.')
        raise TelegramServiceError('Telegram rejected the request. Check the bot token and pairing setup.')
    logger.info('[Telegram] Telegram API response: success')
    return result.get('result')


def start_pairing(user):
    if user.telegram_chat_id:
        raise TelegramServiceError('Telegram is already connected. Disconnect it before connecting a different chat.')
    bot = _api('getMe')
    username = bot.get('username') if isinstance(bot, dict) else None
    if not username:
        raise TelegramServiceError('Telegram did not return a valid bot username.')
    code = secrets.token_urlsafe(24)
    code_hash = hashlib.sha256(code.encode('ascii')).hexdigest()
    now = timezone.now()
    TelegramPairing.objects.filter(user=user).delete()
    TelegramPairing.objects.filter(expires_at__lte=now).delete()
    TelegramPairing.objects.create(
        user=user, code_hash=code_hash, expires_at=now + PAIRING_LIFETIME,
    )
    return {
        'bot_url': f'https://t.me/{username}?start={code}',
        'expires_in': int(PAIRING_LIFETIME.total_seconds()),
    }


def send_telegram_message(chat_id, message):
    logger.info('[Telegram] Sending message...')
    result = _api('sendMessage', {'chat_id': chat_id, 'text': message})
    if not isinstance(result, dict) or not result.get('message_id'):
        logger.warning('[Telegram] Telegram API response: error (missing message ID).')
        raise TelegramServiceError('Telegram did not confirm the message.')
    return result


def _start_code(update):
    message = update.get('message') or {}
    chat = message.get('chat') or {}
    sender = message.get('from') or {}
    if chat.get('type') != 'private' or sender.get('id') != chat.get('id'):
        return None
    text = (message.get('text') or '').strip()
    parts = text.split(maxsplit=1)
    if not parts:
        return None
    cmd = parts[0].split('@', 1)[0].lower()
    if cmd != '/start':
        return None
    if len(parts) == 2:
        code = parts[1].strip()
        if code and len(code) <= 64 and all(c.isalnum() or c in '-_' for c in code):
            return code, str(chat['id'])
        return None
    # Bare /start command
    return '', str(chat['id'])


def verify_pairing(user):
    now = timezone.now()
    if user.telegram_chat_id:
        logger.info('[Telegram] Verification checked: user %s already connected.', user.username)
        return {'connected': True, 'notify_on_laptop_unlock_telegram': user.notify_on_laptop_unlock_telegram}

    active_pairings = TelegramPairing.objects.filter(user=user, expires_at__gt=now)
    if not active_pairings.exists():
        logger.warning('[Telegram] Verification failed: pairing link expired or not started for user %s.', user.username)
        raise TelegramServiceError('Start a fresh Telegram connection from NodeBeacon; the pairing link expired.')
    user_pairing = active_pairings.first()

    with transaction.atomic():
        TelegramBotCursor.objects.get_or_create(pk=1)
        cursor = TelegramBotCursor.objects.select_for_update().get(pk=1)

        offset = cursor.update_offset if cursor.update_offset > 0 else 0
        updates = _api('getUpdates', {'offset': offset, 'limit': 100, 'timeout': 0})

        # Self-healing cursor check: if stored offset returned 0 updates, check if cursor was out of sync with current bot
        if not updates and offset > 0:
            try:
                unfiltered = _api('getUpdates', {'limit': 100, 'timeout': 0})
                if unfiltered and isinstance(unfiltered, list):
                    earliest_id = min(u.get('update_id', offset) for u in unfiltered if isinstance(u.get('update_id'), int))
                    if earliest_id < offset:
                        logger.warning(
                            '[Telegram] Stored cursor offset (%s) was ahead of Telegram updates (earliest: %s); adopting current stream.',
                            offset, earliest_id,
                        )
                        updates = unfiltered
                        cursor.update_offset = 0
            except Exception as exc:
                logger.debug('[Telegram] Cursor stream probe skipped: %s', exc)

        max_update = cursor.update_offset - 1 if cursor.update_offset else -1
        logger.info('[Telegram] Inspecting %d updates for user %s pairing (offset=%s)', len(updates or []), user.username, offset)

        for update in updates or []:
            update_id = update.get('update_id')
            if isinstance(update_id, int):
                max_update = max(max_update, update_id)
            parsed = _start_code(update)
            if not parsed:
                continue
            code, chat_id = parsed

            pairing = None
            if code:
                code_hash = hashlib.sha256(code.encode('ascii')).hexdigest()
                pairing = TelegramPairing.objects.select_related('user').filter(
                    code_hash=code_hash, expires_at__gt=now,
                ).first()
            else:
                # Bare /start: Match against the verifying user's active pairing
                pairing = user_pairing

            if not pairing:
                continue
            if pairing.user.telegram_chat_id:
                pairing.delete()
                continue

            existing_owner = User.objects.filter(telegram_chat_id=chat_id).exclude(pk=pairing.user.pk).first()
            if existing_owner:
                logger.warning('[Telegram] Chat ID is already assigned to %s.', existing_owner.username)
                raise TelegramServiceError('This Telegram chat is already connected to another NodeBeacon account. Disconnect it there first.')

            try:
                send_telegram_message(
                    chat_id,
                    'NodeBeacon Telegram is connected. You will receive laptop unlock alerts here when enabled.',
                )
                with transaction.atomic():
                    pairing.user.telegram_chat_id = chat_id
                    pairing.user.save(update_fields=['telegram_chat_id'])
                pairing.delete()
                logger.info('[Telegram] Successfully paired chat for user %s', pairing.user.username)
                break
            except IntegrityError:
                pairing.delete()
                logger.warning('[Telegram] Integrity error saving chat for user %s', pairing.user.username)
                raise TelegramServiceError('This Telegram chat is already connected to another NodeBeacon account.')

        if max_update >= 0:
            cursor.update_offset = max_update + 1
            cursor.save(update_fields=['update_offset'])

    user.refresh_from_db(fields=['telegram_chat_id', 'notify_on_laptop_unlock_telegram'])
    if not user.telegram_chat_id:
        logger.warning('[Telegram] Verification result: no matching start message found for user %s', user.username)
        raise TelegramServiceError('No matching Telegram Start message found. Open the bot link, press Start, then verify again.')
    logger.info('[Telegram] Verification result: success for user %s', user.username)
    return {'connected': True, 'notify_on_laptop_unlock_telegram': user.notify_on_laptop_unlock_telegram}
