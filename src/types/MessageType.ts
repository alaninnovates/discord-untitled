import { UntitledClient, BaseArgumentType, BaseMessage } from '../';
import { Message } from 'discord.js';

export class MessageArgumentType<T extends UntitledClient = UntitledClient> extends BaseArgumentType {
	public readonly client: T;

	public constructor(client: T) {
		super(client, 'message');
	}

	public async validate(value: string, msg: BaseMessage): Promise<boolean> {
		if (!/^[0-9]+$/.test(value)) return false;
		return Boolean(await msg.channel.fetchMessage(value).catch(() => null));
	}

	public parse(value: string, msg: BaseMessage): Message {
		return msg.channel.messages.get(value);
	}
}
