import { Message } from 'discord.js';

export type ArgumentResult = {
	values?: any | any[];
	cancelled?: 'user' | 'time' | 'promptLimit';
	prompts: Message[];
	answers: Message[];
};
