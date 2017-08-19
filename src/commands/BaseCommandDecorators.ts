import { UntitledClient, BaseCommand } from '../';
import { ArgumentInfo, ThrottlingOptions } from '../types/index';

export function args(...values: ArgumentInfo[]) {
	return function(target: BaseCommand<UntitledClient>, key: string, descriptor: PropertyDescriptor): PropertyDescriptor {
		if (!target) throw new Error('y u do this;');
		if (key !== 'run') throw new Error('y u do this;²');
		if (!descriptor) descriptor = Object.getOwnPropertyDescriptor(target, key);
		Object.defineProperty(Object.getPrototypeOf(target), 'args', {
			value: values,
			configurable: true,
			enumerable: true,
			writable: true
		});
		return descriptor;
	};
}

export function name(value: string): ClassDecorator {
	return _setMetaData('name', value);
}

export function aliases(...values: string[]): ClassDecorator {
	return _setMetaData('aliases', values);
}

export function autoAliases<T extends Function>(target: T): T {
	return _setFlagMetaData('aliases', target);
}

export function group(value: string): ClassDecorator {
	return _setMetaData('groupID', value);
}

export function memberName(value: string): ClassDecorator {
	return _setMetaData('memberName', value);
}

export function description(value: string): ClassDecorator {
	return _setMetaData('description', value);
}

export function format(value: string): ClassDecorator {
	return _setMetaData('format', value);
}

export function details(value: string): ClassDecorator {
	return _setMetaData('details', value);
}

export function examples(...values: string[]): ClassDecorator {
	return _setMetaData('examples', values);
}

export function guildOnly<T extends Function>(target: T): T {
	return _setFlagMetaData('guildOnly', target);
}

export function throttling(value: ThrottlingOptions): ClassDecorator {
	return _setMetaData('throttling', value);
}

export function defaultHandling<T extends Function>(target: T): T {
	return _setFlagMetaData('defaultHandling', target);
}

export function argsPromptLimit(value: number): ClassDecorator {
	return _setMetaData('argsPromptLimit', value);
}

export function argsType(value: string): ClassDecorator {
	return _setMetaData('argsType', value);
}

export function argsCount(value: number): ClassDecorator {
	return _setMetaData('argsCount', value);
}

export function argsSingleQuotes<T extends Function>(target: T): T {
	return _setFlagMetaData('argsSingleQuotes', target);
}

export function patterns(...values: RegExp[]): ClassDecorator {
	return _setMetaData('patterns', values);
}

export function guarded<T extends Function>(target: T): T {
	return _setFlagMetaData('guarded', target);
}

function _setFlagMetaData<T extends Function>(flag: string, target: T): T {
	Object.defineProperty(target.prototype, flag, {
		value: true,
		enumerable: true
	});
	return target;
}

function _setMetaData(key: string, value: any): ClassDecorator {
	return function<T extends Function>(target: T): T {
		Object.defineProperty(target.prototype, key, {
			value: value,
			configurable: true,
			enumerable: true,
			writable: true
		});
		return target;
	};
}
