import { UntitledClient, BaseCommand, BaseCommandGroup, BaseCommandDecorators, BaseMessage, disambiguation } from '../../';
import { oneLine, stripIndents } from 'common-tags';
import { Collection, Message } from 'discord.js';

const { name, aliases, group, memberName, description, details, examples, guarded, args } = BaseCommandDecorators;

@name('unload')
@aliases('unload-command')
@group('commands')
@memberName('unload')
@description('Unloads a command.')
@details(oneLine`
	The argument must be the name/ID (partial or whole) of a command.
	Only the bot owner(s) may use this command.
`)
@examples('unload some-command')
@guarded
export class ReloadCommandCommand extends BaseCommand {
	public hasPermission(msg: BaseMessage): boolean {
		return this.client.isOwner(msg.author);
	}

	@args({
		key: 'command',
		prompt: 'which command would you like to unload?\n',
		validate: (val: string) => {
			if (!val) return false;
			const commands: BaseCommand[] = (this.client.registry.findCommands(val) as BaseCommand[]);
			if (commands.length === 1) return true;
			if (commands.length === 0) return false;
			return disambiguation(commands, 'commands');
		},
		parse: (val: string) => (this.client.registry.findCommands(val) as BaseCommand[])[0]
	})
	public async run(msg: BaseMessage, { command }: { command: BaseCommand }): Promise<Message | Message[]> {
		command.unload();
		await msg.reply(`Unloaded \`${command.name}\` command.`);
		return null;
	}
}
