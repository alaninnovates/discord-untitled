import { UntitledClient, BaseArgument, BaseArgumentType, BaseMessage } from '../';

export class StringArgumentType<T extends UntitledClient = UntitledClient> extends BaseArgumentType {
	public readonly client: T;

	public constructor(client: T) {
		super(client, 'string');
	}

	public validate(value: string, msg: BaseMessage, arg: BaseArgument): boolean {
		return Boolean(value) &&
			(arg.min === null || typeof arg.min === 'undefined' || value.length >= arg.min) &&
			(arg.max === null || typeof arg.max === 'undefined' || value.length <= arg.max);
	}

	public parse(value: string): string {
		return value;
	}
}
