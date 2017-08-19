import { UntitledClient, BaseArgument, BaseArgumentType, BaseMessage } from '../';

export class FloatArgumentType<T extends UntitledClient = UntitledClient> extends BaseArgumentType {
	public readonly client: T;

	public constructor(client: T) {
		super(client, 'float');
	}

	public validate(value: string, msg: BaseMessage, arg: BaseArgument): boolean {
		const float: number = Number.parseFloat(value);
		return !Number.isNaN(float) &&
			(arg.min === null || typeof arg.min === 'undefined' || float >= arg.min) &&
			(arg.max === null || typeof arg.max === 'undefined' || float <= arg.max);
	}

	public parse(value: string): number {
		return Number.parseFloat(value);
	}
}
