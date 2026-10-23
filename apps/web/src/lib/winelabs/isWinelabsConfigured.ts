import serverConfig from '@/server.config';

/**
 * Whether the Wine Labs key is set, so screens can say so rather than fail
 */
const isWinelabsConfigured = () => Boolean(serverConfig.winelabsUserId?.replace(/\s/g, ''));

export default isWinelabsConfigured;
