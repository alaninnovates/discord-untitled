import { Message } from 'discord.js';

export type ArgumentCollectorResult = {
	values?: any;
	cancelled?: string;
	prompts: Message[];
	answers: Message[];
};
