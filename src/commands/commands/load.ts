import { UntitledClient, BaseCommand, BaseCommandGroup, BaseMessage } from '../../';
import { oneLine, stripIndents } from 'common-tags';
import { Message } from 'discord.js';
import * as fs from 'fs';

export class LoadCommandCommand<T extends UntitledClient = UntitledClient> extends BaseCommand {
	public readonly client: T;
	public constructor(client: T) {
		super(client, {
			name: 'load',
			aliases: ['load-command'],
			group: 'commands',
			memberName: 'load',
			description: 'Loads a new command.',
			details: oneLine`
				The argument must be full name of the command in the format of \`group:memberName\`.
				Only the bot owner(s) may use this command.
			`,
			examples: ['load some-command'],
			guarded: true,

			args: [
				{
					key: 'command',
					prompt: 'Which command would you like to load?',
					validate: (val: string) => new Promise(resolve => {
						if (!val) return resolve(false);
						const split: string[] = val.split(':');
						if (split.length !== 2) return resolve(false);
						if ((this.client.registry.findCommands(val) as BaseCommand[]).length > 0) {
							return resolve('That command is already registered.');
						}
						const cmdPath: string = this.client.registry.resolveCommandPath(split[0], split[1]);
						fs.access(cmdPath, fs.constants.R_OK, (err: Error) => err ? resolve(false) : resolve(true));
						return null;
					}),
					parse: (val: string) => {
						const split: string[] = val.split(':');
						const cmdPath: string = this.client.registry.resolveCommandPath(split[0], split[1]);
						delete require.cache[cmdPath];
						return require(cmdPath);
					}
				}
			]
		});
	}

	public hasPermission(msg: BaseMessage): boolean {
		return this.client.isOwner(msg.author);
	}

	public async run(msg: BaseMessage, { command }: { command: BaseCommand }): Promise<Message | Message[]> {
		this.client.registry.registerCommand(command);
		await msg.reply(`Loaded \`${this.client.registry.commands.last().name}\` command.`);
		return null;
	}
}
