import { BaseCommand, BaseCommandDecorators, BaseMessage } from '../../../dist';
import { Message } from 'discord.js';

const { name, group, memberName, description } = BaseCommandDecorators;

@name('test')
@group('util')
@memberName('test')
@description('this is a test command.')
export class TestCommand extends BaseCommand {
	public run(msg: BaseMessage): Promise<Message | Message[]> {
		return msg.say('hi');
	}
}
