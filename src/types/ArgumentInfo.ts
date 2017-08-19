import { BaseMessage } from '../';

export type ArgumentInfo = {
	key: string;
	label?: string;
	prompt: string;
	type?: string;
	max?: number;
	min?: number;
	default?: any;
	infinite?: boolean;
	validate?: (val: string, msg?: BaseMessage) => any | Promise<any>;
	parse?: (val: string, msg?: BaseMessage) => any | Promise<any>;
	wait?: number;
};
