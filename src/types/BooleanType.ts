import { UntitledClient, BaseArgumentType } from '../';

export class BooleanArgumentType<T extends UntitledClient = UntitledClient> extends BaseArgumentType {
	public readonly client: T;
	public truthy: Set<string>;
	public falsy: Set<string>;

	public constructor() {
		super('boolean');
		this.truthy = new Set(['true', 't', 'yes', 'y', 'on', 'enable', 'enabled', '1', '+']);
		this.falsy = new Set(['false', 'f', 'no', 'n', 'off', 'disable', 'disabled', '0', '-']);
	}

	public validate(value: string): boolean {
		const lc: string = value.toLowerCase();
		return this.truthy.has(lc) || this.falsy.has(lc);
	}

	public parse(value: string): boolean {
		const lc: string = value.toLowerCase();
		if (this.truthy.has(lc)) return true;
		if (this.falsy.has(lc)) return false;
		throw new RangeError('Unknown boolean value.');
	}
}
