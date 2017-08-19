import { UntitledClient, BaseArgument, BaseArgumentType, BaseMessage } from '../';

export class IntegerArgumentType<T extends UntitledClient = UntitledClient> extends BaseArgumentType {
	public readonly client: T;

	public constructor(client: T) {
		super(client, 'integer');
	}

	public validate(value: string, msg: BaseMessage, arg: BaseArgument): boolean {
		const int: number = Number.parseInt(value);
		return !Number.isNaN(int) &&
			(arg.min === null || typeof arg.min === 'undefined' || int >= arg.min) &&
			(arg.max === null || typeof arg.max === 'undefined' || int <= arg.max);
	}

	public parse(value: string): number {
		return Number.parseInt(value);
	}
}
