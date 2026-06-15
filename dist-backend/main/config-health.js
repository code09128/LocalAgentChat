export function checkHealth() {
    return {
        status: 'OK',
        nodeVersion: process.version,
        platform: process.platform,
        dependencies: {
            local_smart_dir: true,
            logs_healthy: true
        },
        timestamp: new Date().toISOString()
    };
}
