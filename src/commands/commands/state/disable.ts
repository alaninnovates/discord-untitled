import { UntitledClient, BaseArgument, BaseCommand, BaseCommandGroup, BaseCommandDecorators, BaseMessage, disambiguation } from '../../../';
import { oneLine, stripIndents } from 'common-tags';
import { Collection, Message } from 'discord.js';

const { name, aliases, group, memberName, description, details, examples, guarded, args } = BaseCommandDecorators;

@name('disable')
@aliases('disable-command', 'cmd-off', 'command-off')
@group('commands')
@memberName('disable')
@description('Disables a command or command group.')
@details(oneLine`
	The argument must be the name/ID (partial or whole) of a command or command group.
	Only administrators may use this command.
`)
@examples('disable util', 'disable Utility', 'disable prefix')
@guarded
export class DisableCommandCommand extends BaseCommand {
	public hasPermission(msg: BaseMessage): boolean {
		if (!msg.guild) return this.client.isOwner(msg.author);
		return msg.member.hasPermission('ADMINISTRATOR') || this.client.isOwner(msg.author);
	}

	@args({
		key: 'cmdOrGrp',
		label: 'command/group',
		prompt: 'which command or group would you like to disable?\n',
		validate: (val: string) => {
			if (!val) return false;
			const groups: BaseCommandGroup[] = ((this as BaseCommand).client.registry.findGroups(val) as BaseCommandGroup[]);
			if (groups.length === 1) return true;
			const commands: BaseCommand[] = ((this as BaseCommand).client.registry.findCommands(val) as BaseCommand[]);
			if (commands.length === 1) return true;
			if (commands.length === 0 && groups.length === 0) return false;
			return stripIndents`
				${commands.length > 1 ? disambiguation(commands, 'commands') : ''}
				${groups.length > 1 ? disambiguation(groups, 'groups') : ''}
			`;
		},
		parse: (val: string) => ((this as BaseCommand).client.registry.findGroups(val) as BaseCommandGroup[])[0] || ((this as BaseCommand).client.registry.findCommands(val) as BaseCommand[])[0]
	})
	public run(msg: BaseMessage, { cmdOrGrp }: { cmdOrGrp: BaseCommandGroup | BaseCommand }): Promise<Message | Message[]> {
		if (!cmdOrGrp.isEnabledIn(msg.guild)) {
			return msg.reply(
				`The \`${cmdOrGrp.name}\` ${(cmdOrGrp as BaseCommand).group ? 'command' : 'group'} is already disabled.`
			);
		}
		if (cmdOrGrp.guarded) {
			return msg.reply(
				`You cannot disable the \`${cmdOrGrp.name}\` ${(cmdOrGrp as BaseCommand).group ? 'command' : 'group'}.`
			);
		}
		cmdOrGrp.setEnabledIn(msg.guild, false);
		return msg.reply(`Disabled the \`${cmdOrGrp.name}\` ${(cmdOrGrp as BaseCommand).group ? 'command' : 'group'}.`);
	}
}
