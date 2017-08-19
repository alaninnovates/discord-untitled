import { Message } from 'discord.js';

export type ArgumentResult = {
	value?: any | any[];
	cancelled?: 'user' | 'time' | 'promptLimit';
	prompts: Message[];
	answers: Message[];
};
