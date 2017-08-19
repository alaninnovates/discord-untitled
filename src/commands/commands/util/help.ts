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
		prompt: 'Which command would you like to view the help for?',
		type: 'string',
		default: ''
	})
	public async run(msg: BaseMessage, { command }: { command: string }): Promise<Message | Message[]> {
		const groups: Collection<string, BaseCommandGroup> = this.client.registry.groups;
		const commands: Collection<string, BaseCommand> | BaseCommand[] = this.client.registry.findCommands(command, false, msg);
		const showAll: boolean = command && command.toLowerCase() === 'all';
		if (command && !showAll) {
			if ((commands as BaseCommand[]).length === 1) {
				const commandsType: BaseCommand[] = (commands as BaseCommand[]);
				let help: string = stripIndents`
					${oneLine`
						__Command **${commandsType[0].name}**:__ ${commandsType[0].description}
						${commandsType[0].guildOnly ? ' (Usable only in servers)' : ''}
					`}

					**Format:** ${msg.anyUsage(`${commandsType[0].name}${commandsType[0].format ? ` ${commandsType[0].format}` : ''}`)}
				`;
				if (commandsType[0].aliases.length > 0) help += `\n**Aliases:** ${commandsType[0].aliases.join(', ')}`;
				help += `\n${oneLine`
					**Group:** ${commandsType[0].group.name}
					(\`${commandsType[0].groupID}:${commandsType[0].memberName}\`)
				`}`;
				if (commandsType[0].details) help += `\n**Details:** ${commandsType[0].details}`;
				if (commandsType[0].examples) help += `\n**Examples:**\n${commandsType[0].examples.join('\n')}`;

				const messages = [];
				try {
					messages.push(await msg.direct(help));
					if (msg.channel.type !== 'dm') messages.push(await msg.reply('sent you a DM with information.'));
				} catch (err) {
					messages.push(await msg.reply('unable to send you the help DM. You probably have DMs disabled.'));
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
			const messages = [];
			try {
				messages.push(await msg.direct(stripIndents`
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
				`, { split: true }));
				if (msg.channel.type !== 'dm') messages.push(await msg.reply('sent you a DM with information.'));
			} catch (err) {
				messages.push(await msg.reply('unable to send you the help DM. You probably have DMs disabled.'));
			}
			return (messages as Message[]);
		}
	}
}
