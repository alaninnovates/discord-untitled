import { ArgumentInfo } from '.';
import { ThrottlingOptions } from '.';

export type CommandInfo = {
	name: string;
	aliases?: string[];
	autoAliases?: boolean;
	group: string;
	memberName: string;
	description: string;
	format?: string;
	details?: string;
	examples?: string[];
	guildOnly?: boolean;
	throttling?: ThrottlingOptions;
	defaultHandling?: boolean;
	args?: ArgumentInfo[];
	argsPromptLimit?: number;
	argsType?: string;
	argsCount?: number;
	argsSingleQuotes?: boolean;
	patterns?: RegExp[];
	guarded?: boolean;
};
