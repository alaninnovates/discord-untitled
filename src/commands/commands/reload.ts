import { UntitledClient, BaseCommand, BaseCommandGroup, BaseCommandDecorators, BaseMessage, disambiguation } from '../../';
import { oneLine, stripIndents } from 'common-tags';
import { Collection, Message } from 'discord.js';

const { name, aliases, group, memberName, description, details, examples, guarded, args } = BaseCommandDecorators;

@name('reload')
@aliases('reload-command')
@group('commands')
@memberName('reload')
@description('Reloads a command or command group')
@details(oneLine`
	The argument must be the name/ID (partial or whole) of a command or command group.
	Providing a command group will reload all of the commands in that group.
	Only the bot owner(s) may use this command.
`)
@examples('reload some-command')
@guarded
export class ReloadCommandCommand extends BaseCommand {
	public hasPermission(msg: BaseMessage): boolean {
		return this.client.isOwner(msg.author);
	}

	@args({
		key: 'cmdOrGrp',
		label: 'command/group',
		prompt: 'which command or group would you like to reload?\n',
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
	public async run(msg: BaseMessage, { cmdOrGrp }: { cmdOrGrp: BaseCommand | BaseCommandGroup }): Promise<Message | Message[]> {
		cmdOrGrp.reload();
		if ((cmdOrGrp as BaseCommand).group) {
			await msg.reply(`Reloaded \`${cmdOrGrp.name}\` command.`);
		} else {
			await msg.reply(`Reloaded all of the commands in the \`${cmdOrGrp.name}\` group.`);
		}
		return null;
	}
}
