-- Optional examples for the DBMS presentation.
-- These are educational database objects and are not required by Django.

-- Example read-only view. Run after Django migrations and adjust names if the
-- project's table naming configuration changes.
CREATE OR REPLACE VIEW server_latest_metrics AS
SELECT
    s.id AS server_id,
    s.name AS server_name,
    s.status,
    s.last_seen,
    m.cpu_usage,
    m.memory_usage,
    m.disk_usage,
    m.timestamp AS metric_timestamp
FROM servers_server s
LEFT JOIN metrics_metric m
    ON m.id = (
        SELECT m2.id
        FROM metrics_metric m2
        WHERE m2.server_id = s.id
        ORDER BY m2.timestamp DESC
        LIMIT 1
    );

-- Example reporting procedure. It does not replace Django application logic.
DELIMITER //
CREATE PROCEDURE server_metric_summary(IN requested_server_id BIGINT)
BEGIN
    SELECT
        server_id,
        COUNT(*) AS sample_count,
        AVG(cpu_usage) AS average_cpu,
        AVG(memory_usage) AS average_memory,
        AVG(disk_usage) AS average_disk,
        MIN(timestamp) AS first_sample,
        MAX(timestamp) AS last_sample
    FROM metrics_metric
    WHERE server_id = requested_server_id
    GROUP BY server_id;
END//
DELIMITER ;
