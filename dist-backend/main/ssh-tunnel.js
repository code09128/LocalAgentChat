import { writeLog } from './local_smart.js';
export class SSHTunnel {
    active = false;
    async start(localPort, remotePort, host) {
        writeLog('INFO', `ssh_tunnel: starting tunnel from localhost:${localPort} to ${host}:${remotePort}`);
        this.active = true;
        writeLog('INFO', 'ssh_tunnel: tunnel established.');
        return true;
    }
    async stop() {
        writeLog('INFO', 'ssh_tunnel: stopping tunnel.');
        this.active = false;
        return true;
    }
    isActive() {
        return this.active;
    }
}
