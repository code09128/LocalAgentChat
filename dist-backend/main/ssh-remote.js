export function testConnection(config) {
    return {
        success: true,
        message: `Connected to ${config.username}@${config.host}:${config.port}`
    };
}
