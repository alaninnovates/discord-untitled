import { UntitledClient, BaseCommand, BaseCommandGroup, BaseCommandDecorators, BaseMessage, disambiguation } from '../../../';
import { GuildExtension } from '../../../extensions/GuildExtension';
import { oneLine, stripIndents } from 'common-tags';
import { Collection, Message } from 'discord.js';

const { name, aliases, group, memberName, description, details, examples, guarded, args } = BaseCommandDecorators;

@name('help')
@aliases('commands')
@group('util')
@memberName('help')
@description('Displays a list of available commands, or detailed information for a specified command.')
@details(oneLine`
	The command may be part of a command name or a whole command name.
	If it isn't specified, all available commands will be listed.
`)
@examples('help', 'help prefix')
@guarded
export class HelpCommand extends BaseCommand {
	@args({
		key: 'command',
		prompt: 'which command would you like to view the help for?\n',
		type: 'string',
		default: ''
	})
	public async run(msg: BaseMessage, { command }: { command: string }): Promise<Message | Message[]> {
		const groups: Collection<string, BaseCommandGroup> = this.client.registry.groups;
		const commands: BaseCommand[] = (this.client.registry.findCommands(command, false, msg) as BaseCommand[]);
		const showAll: boolean = command && command.toLowerCase() === 'all';
		if (command && !showAll) {
			if (commands.length === 1) {
				let help: string = stripIndents`
					${oneLine`
						__Command **${commands[0].name}**:__ ${commands[0].description}
						${commands[0].guildOnly ? ' (Usable only in servers)' : ''}
					`}

					**Format:** ${msg.anyUsage(`${commands[0].name}${commands[0].format ? ` ${commands[0].format}` : ''}`)}
				`;
				if (commands[0].aliases.length > 0) help += `\n**Aliases:** ${commands[0].aliases.join(', ')}`;
				help += `\n${oneLine`
					**Group:** ${commands[0].group.name}
					(\`${commands[0].groupID}:${commands[0].memberName}\`)
				`}`;
				if (commands[0].details) help += `\n**Details:** ${commands[0].details}`;
				if (commands[0].examples) help += `\n**Examples:**\n${commands[0].examples.join('\n')}`;

				const messages: Message[] = [];
				try {
					messages.push((await msg.direct(help) as Message));
					if (msg.channel.type !== 'dm') messages.push((await msg.reply('sent you a DM with information.') as Message));
				} catch (err) {
					messages.push((await msg.reply('unable to send you the help DM. You probably have DMs disabled.') as Message));
				}
				return (messages as Message[]);
			} else if ((commands as BaseCommand[]).length > 1) {
				return msg.reply(disambiguation((commands as BaseCommand[]), 'commands'));
			} else {
				return msg.reply(
					`Unable to identify command. Use ${msg.usage(
						null, msg.channel.type === 'dm' ? null : undefined, msg.channel.type === 'dm' ? null : undefined
					)} to view the list of all commands.`
				);
			}
		} else {
			const messages: Message[] = [];
			try {
				messages.push((await msg.direct(stripIndents`
					${oneLine`
						To run a command in ${msg.guild || 'any server'},
						use ${BaseCommand.usage('command', msg.guild ? (msg.guild as GuildExtension).commandPrefix : null, this.client.user)}.
						For example, ${BaseCommand.usage('prefix', msg.guild ? (msg.guild as GuildExtension).commandPrefix : null, this.client.user)}.
					`}
					To run a command in this DM, simply use ${BaseCommand.usage('command', null, null)} with no prefix.

					Use ${this.usage('<command>', null, null)} to view detailed information about a specific command.
					Use ${this.usage('all', null, null)} to view a list of *all* commands, not just available ones.

					__**${showAll ? 'All commands' : `Available commands in ${msg.guild || 'this DM'}`}**__

					${(showAll ? groups : groups.filter((grp: BaseCommandGroup) => grp.commands.some((cmd: BaseCommand) => cmd.isUsable(msg))))
						.map(grp => stripIndents`
							__${grp.name}__
							${(showAll ? grp.commands : grp.commands.filter((cmd: BaseCommand) => cmd.isUsable(msg)))
								.map((cmd: BaseCommand) => `**${cmd.name}:** ${cmd.description}`).join('\n')
							}
						`).join('\n\n')
					}
				`, { split: true }) as Message));
				if (msg.channel.type !== 'dm') messages.push((await msg.reply('sent you a DM with information.') as Message));
			} catch (err) {
				messages.push((await msg.reply('unable to send you the help DM. You probably have DMs disabled.') as Message));
			}
			return (messages as Message[]);
		}
	}
}
