import { 
  RedditIconOfficial, 
  GitHubIconOfficial, 
  GmailIconOfficial, 
  CalendarIconOfficial, 
  NotionIconOfficial, 
  SlackIconOfficial, 
  DiscordIconOfficial,
  OutlookIconOfficial,
  AsanaIconOfficial,
  TrelloIconOfficial,
  LinearIconOfficial,
  ClickUpIconOfficial
} from '../components/common/icons/PlatformIcons';

export const ALL_POSSIBLE_PLATFORMS = [
  { id: 'github', name: 'GitHub', icon: <GitHubIconOfficial /> },
  { id: 'gmail', name: 'Gmail', icon: <GmailIconOfficial /> },
  { id: 'google-calendar', name: 'Google Calendar', icon: <CalendarIconOfficial /> },
  { id: 'outlook', name: 'Outlook', icon: <OutlookIconOfficial /> },
  { id: 'reddit', name: 'Reddit', icon: <RedditIconOfficial /> },
  { id: 'notion', name: 'Notion', icon: <NotionIconOfficial /> },
  { id: 'slack', name: 'Slack', icon: <SlackIconOfficial /> },
  { id: 'discord', name: 'Discord', icon: <DiscordIconOfficial /> },
  { id: 'asana', name: 'Asana', icon: <AsanaIconOfficial /> },
  { id: 'trello', name: 'Trello', icon: <TrelloIconOfficial /> },
  { id: 'linear', name: 'Linear', icon: <LinearIconOfficial /> },
  { id: 'clickup', name: 'ClickUp', icon: <ClickUpIconOfficial /> }
];
