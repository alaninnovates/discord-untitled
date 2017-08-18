import {
	UntitledClient,
	FriendlyError,
	BaseCommand,
	BaseCommandGroup,
	BaseMessage
} from '../dist';
import { Guild } from 'discord.js';
import { oneLine } from 'common-tags';

const client = new UntitledClient({
	owner: '81440962496172032',
	commandPrefix: 'cdev'
});

client
	.on('error', console.error)
	.on('warn', console.warn)
	.on('debug', console.log)
	.on('ready', () => {
		console.log(`Client ready; logged in as ${client.user.tag} (${client.user.id})`);
	})
	.on('disconnect', (): void => { console.warn('Disconnected!'); })
	.on('reconnecting', (): void => { console.warn('Reconnecting...'); })
	.on('commandError', (cmd: BaseCommand, err: Error): void => {
		if (err instanceof FriendlyError) return;
		console.error(`Error in command ${cmd.groupID}:${cmd.memberName}`, err);
	})
	.on('commandBlocked', (msg: BaseMessage, reason: string): void => {
		console.log(oneLine`
			Command ${msg.command ? `${msg.command.groupID}:${msg.command.memberName}` : ''}
			blocked; ${reason}
		`);
	})
	.on('commandPrefixChange', (guild: Guild, prefix: string): void => {
		console.log(oneLine`
			Prefix ${prefix === '' ? 'removed' : `changed to ${prefix || 'the default'}`}
			${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.
		`);
	})
	.on('commandStatusChange', (guild: Guild, command: BaseCommand, enabled: boolean): void => {
		console.log(oneLine`
			Command ${command.groupID}:${command.memberName}
			${enabled ? 'enabled' : 'disabled'}
			${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.
		`);
	})
	.on('groupStatusChange', (guild: Guild, group: BaseCommandGroup, enabled: boolean): void => {
		console.log(oneLine`
			Group ${group.id}
			${enabled ? 'enabled' : 'disabled'}
			${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.
		`);
	});

client.registry
	.registerDefaultTypes()
	.registerDefaultGroups()
	.registerDefaultCommands({ eval_: false, help: false, prefix: false });

client.login(token);
