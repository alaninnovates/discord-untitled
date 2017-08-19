import { UntitledClient, BaseCommand, BaseCommandGroup, BaseCommandDecorators, BaseMessage } from '../../../';
import { GuildExtension } from '../../../extensions/GuildExtension';
import { oneLine, stripIndents } from 'common-tags';
import { Message } from 'discord.js';

const { name, group, memberName, description, format, details, examples, throttling, args } = BaseCommandDecorators;

@name('prefix')
@group('util')
@memberName('prefix')
@description('Shows or sets the command prefix.')
@format('[prefix/"default"/"none"]')
@details(oneLine`
	If no prefix is provided, the current prefix will be shown.
	If the prefix is "default", the prefix will be reset to the bot's default prefix.
	If the prefix is "none", the prefix will be removed entirely, only allowing mentions to run commands.
	Only administrators may change the prefix.
`)
@examples('prefix', 'prefix -', 'prefix omg!', 'prefix default', 'prefix none')
@throttling({ usages: 5, duration: 10 })
export class PrefixCommand extends BaseCommand {
	@args({
		key: 'prefix',
		prompt: 'what would you like to set the bot\'s prefix to?\n',
		type: 'string',
		max: 15,
		default: ''
	})
	public async run(msg: BaseMessage, { prefix }: { prefix: string }): Promise<Message | Message[]> {
		if (!prefix) {
			// tslint:disable-next-line:no-shadowed-variable
			const newPrefix: string = msg.guild ? (msg.guild as GuildExtension).commandPrefix : this.client.commandPrefix;
			return msg.reply(stripIndents`
				${prefix ? `The command prefix is \`${prefix}\`.` : 'There is no command prefix.'}
				To run commands, use ${msg.anyUsage('command')}.
			`);
		}

		if (msg.guild) {
			if (!msg.member.hasPermission('ADMINISTRATOR') && !this.client.isOwner(msg.author)) {
				return msg.reply('Only administrators may change the command prefix.');
			}
		} else if (!this.client.isOwner(msg.author)) {
			return msg.reply('Only the bot owners(s) may change the global command prefix.');
		}

		const lowercase: string = prefix.toLowerCase();
		const newPrefix: string = lowercase === 'none' ? '' : prefix;
		let response: string;
		if (lowercase === 'default') {
			if (msg.guild) (msg.guild as GuildExtension).commandPrefix = null;
			else this.client.commandPrefix = null;
			const current: string = this.client.commandPrefix ? `\`${this.client.commandPrefix}\`` : 'no prefix';
			response = `reset the command prefix to the default (currently ${current})`;
		} else {
			if (msg.guild) (msg.guild as GuildExtension).commandPrefix = prefix;
			else this.client.commandPrefix = prefix;
			response = prefix ? `set the command prefix to \`${prefix}\`.` : 'Removed the command prefix entirely';
		}

		await msg.reply(`${response} to run commands, use ${msg.anyUsage('command')}`);
		return null;
	}
}
