import { ClientOptions } from 'discord.js';

export type UntitledClientOptions = {
	selfbot?: boolean;
	commandPrefix?: string;
	commandEditableDuration?: number;
	nonCommandEditable?: boolean;
	unknownCommandResponse?: boolean;
	owner?: string | string[] | Set<string>;
	invite?: string;
} & ClientOptions;
