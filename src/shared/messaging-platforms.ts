export interface MessagingConfig {
  platform: 'discord' | 'slack' | 'telegram';
  webhookUrl: string;
  enabled: boolean;
}

export const activePlatforms: MessagingConfig[] = [];
