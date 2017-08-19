import {
	UntitledClient,
	BaseArgument,
	BaseArgumentType,
	BaseCommand,
	BaseCommandGroup,
	BaseMessage
} from '../';
import { CommandResolvable, CommandGroupResolvable } from '../types';
import { Collection, Message } from 'discord.js';
import * as path from 'path';

export class CommandRegistry<T extends UntitledClient = UntitledClient> {
	public readonly client: T;
	public commands: Collection<string, BaseCommand>;
	public groups: Collection<string, BaseCommandGroup>;
	public types: Collection<string, BaseArgumentType>;
	public evalObjects: object;
	public commandsPath?: string;

	public constructor(client: T) {
		/**
		 * The client this registry is for
		 * @name CommandRegistry#client
		 * @type {UntitledClient}
		 * @readonly
		 */
		this.client = client;

		/**
		 * Registered commands
		 * @type {Collection<string, BaseCommand>}
		 */
		this.commands = new Collection();

		/**
		 * Registered command groups
		 * @type {Collection<string, BaseCommandGroup>}
		 */
		this.groups = new Collection();

		/**
		 * Registered argument types
		 * @type {Collection<string, BaseArgumentType>}
		 */
		this.types = new Collection();

		/**
		 * Registered objects for the eval command
		 * @type {Object}
		 */
		this.evalObjects = {};

		/**
		 * Fully resolved path to the bot's commands directory
		 * @type {?string}
		 */
		this.commandsPath = null;
	}

	/**
	 * Registers a single group
	 * @param {BaseCommandGroup|Function|string[]|string} group - A CommandGroup instance, a constructor,
	 * an array of [ID, Name], or the group ID
	 * @param {string} [name] - Name for the group (if the first argument is the group ID)
	 * @return {CommandRegistry}
	 * @see {@link CommandRegistry#registerGroups}
	 */
	public registerGroup(group: BaseCommandGroup | ((client: T) => BaseCommandGroup) | string[] | string, name?: string): CommandRegistry {
		if (typeof group === 'string') return this.registerGroups([[group, name]]);
		return this.registerGroups([(group as BaseCommandGroup)]);
	}

	/**
	 * Registers multiple groups
	 * @param {BaseCommandGroup[]|Function[]|Array<string[]>} groups - An array of CommandGroup instances, constructors,
	 * or arrays of [ID, Name]
	 * @return {CommandRegistry}
	 */
	public registerGroups(groups: BaseCommandGroup[] | ((client: T) => BaseCommandGroup)[] | (string | boolean)[][]): CommandRegistry {
		if (!Array.isArray(groups)) throw new TypeError('Groups must be an Array.');
		for (let group of groups) {
			if (typeof group === 'function') {
				group = group(this.client);
			} else if (Array.isArray(group)) {
				group = new BaseCommandGroup(this.client, (group[0] as string), (group[1] as string), (group[2] as boolean));
			} else if (!(group instanceof BaseCommandGroup)) {
				// TODO: Fix this hacky mess
				group = (group as BaseCommandGroup);
				group = new BaseCommandGroup(this.client, group.id, group.name, null, group.cmds);
			}

			// TODO: Fix this hacky mess
			group = (group as BaseCommandGroup);

			const existing: BaseCommandGroup = this.groups.get(group.id);
			if (existing) {
				existing.name = group.name;
				this.client.emit('debug', `Group ${group.id} is already registered; renamed it to "${group.name}".`);
			} else {
				this.groups.set(group.id, group);
				/**
				 * Emitted when a group is registered
				 * @event UntitledClient#groupRegister
				 * @param {BaseCommandGroup} group - Group that was registered
				 * @param {CommandRegistry} registry - Registry that the group was registered to
				 */
				this.client.emit('groupRegister', group, this);
				this.client.emit('debug', `Registered group ${group.id}.`);
			}
		}
		return this;
	}

	/**
	 * Registers a single command
	 * @param {BaseCommand|Function} command - Either a Command instance, or a constructor for one
	 * @return {CommandRegistry}
	 * @see {@link CommandRegistry#registerCommands}
	 */
	public registerCommand(command: BaseCommand | ((client: T) => BaseCommand)): CommandRegistry {
		return this.registerCommands([(command as BaseCommand)]);
	}

	/**
	 * Registers multiple commands
	 * @param {BaseCommand[]|Function[]} commands - An array of Command instances or constructors
	 * @return {CommandRegistry}
	 */
	public registerCommands(commands: BaseCommand[] | ((client: T) => BaseCommand)[]): CommandRegistry {
		if (!Array.isArray(commands)) throw new TypeError('Commands must be an Array.');
		for (const command of commands) {
			for (let c of Object.values(command)) {
				if (typeof c === 'function') c = new c(this.client);

				// Verify that it's an actual command
				if (!(c instanceof BaseCommand)) {
					this.client.emit('warn', `Attempting to register an invalid command object: ${command}; skipping.`);
					continue;
				}

				// Make sure there aren't any conflicts
				if (this.commands.some((cmd: BaseCommand) => cmd.name === c.name || cmd.aliases.includes(c.name))) {
					throw new Error(`A command with the name/alias "${c.name}" is already registered.`);
				}
				for (const alias of c.aliases) {
					if (this.commands.some((cmd: BaseCommand) => cmd.name === alias || cmd.aliases.includes(alias))) {
						throw new Error(`A command with the name/alias "${alias}" is already registered.`);
					}
				}
				const group: BaseCommandGroup = this.groups.find((grp: BaseCommandGroup) => grp.id === (c as BaseCommand).groupID);
				if (!group) throw new Error(`Group "${c.groupID}" is not registered.`);
				if (group.commands.some((cmd: BaseCommand) => cmd.memberName === (c as BaseCommand).memberName)) {
					throw new Error(`A command with the member name "${c.memberName}" is already registered in ${group.id}`);
				}

				// Add the command
				c.group = group;
				group.commands.set(c.name, c);
				this.commands.set(c.name, c);
				/**
				 * Emitted when a command is registered
				 * @event UntitledClient#commandRegister
				 * @param {BaseCommand} command - Command that was registered
				 * @param {CommandRegistry} registry - Registry that the command was registered to
				 */
				this.client.emit('commandRegister', c, this);
				this.client.emit('debug', `Registered command ${group.id}:${c.memberName}.`);
			}

		}

		return this;
	}

	/**
	 * Registers all commands in a directory. The files must export a Command class constructor or instance.
	 * @param {string|RequireAllOptions} options - The path to the directory, or a require-all options object
	 * @return {CommandRegistry}
	 */
	public registerCommandsIn(options: string): CommandRegistry {
		const obj = require('require-all')(options);
		const commands: BaseCommand[] = [];
		for (const group of Object.values(obj)) {
			for (let command of Object.values(group)) {
				if (typeof command.default === 'function') command = command.default;
				commands.push(command);
			}
		}
		if (typeof options === 'string' && !this.commandsPath) this.commandsPath = options;
		return this.registerCommands(commands);
	}

	/**
	 * Registers a single argument type
	 * @param {BaseArgumentType|Function} type - Either an ArgumentType instance, or a constructor for one
	 * @return {CommandRegistry}
	 * @see {@link CommandRegistry#registerTypes}
	 */
	public registerType(type: BaseArgumentType | ((client: T) => BaseArgumentType)): CommandRegistry {
		return this.registerTypes([(type as BaseArgumentType)]);
	}

	/**
	 * Registers multiple argument types
	 * @param {BaseArgumentType[]|Function[]} types - An array of ArgumentType instances or constructors
	 * @return {CommandRegistry}
	 */
	public registerTypes(types: BaseArgumentType[] | ((client: T) => BaseArgumentType)[]): CommandRegistry {
		if (!Array.isArray(types)) throw new TypeError('Types must be an Array.');
		for (const type of types) {
			for (let t of Object.values(type)) {
				if (typeof t === 'function') t = new t(this.client);

				// Verify that it's an actual type
				if (!(t instanceof BaseArgumentType)) {
					this.client.emit('warn', `Attempting to register an invalid argument type object: ${t}; skipping.`);
					continue;
				}

				// Make sure there aren't any conflicts
				if (this.types.has(t.id)) throw new Error(`An argument type with the ID "${t.id}" is already registered.`);

				// Add the type
				this.types.set(t.id, t);
				/**
				 * Emitted when an argument type is registered
				 * @event UntitledClient#typeRegister
				 * @param {BaseArgumentType} type - Argument type that was registered
				 * @param {CommandRegistry} registry - Registry that the type was registered to
				 */
				this.client.emit('typeRegister', t, this);
				this.client.emit('debug', `Registered argument type ${t.id}.`);
			}

		}

		return this;
	}

	/**
	 * Registers all argument types in a directory. The files must export an ArgumentType class constructor or instance.
	 * @param {string|RequireAllOptions} options - The path to the directory, or a require-all options object
	 * @return {CommandRegistry}
	 */
	public registerTypesIn(options: string): CommandRegistry {
		const obj = require('require-all')(options);
		const types: BaseArgumentType[] = [];
		for (const type of Object.values(obj)) types.push(type);
		return this.registerTypes(types);
	}

	/**
	 * Registers the default argument types, groups, and commands
	 * @return {CommandRegistry}
	 */
	public registerDefaults(): CommandRegistry {
		this.registerDefaultTypes();
		this.registerDefaultGroups();
		this.registerDefaultCommands();
		return this;
	}

	/**
	 * Registers the default groups
	 * @return {CommandRegistry}
	 */
	public registerDefaultGroups(): CommandRegistry {
		return this.registerGroups([
			['commands', 'Commands', true],
			['util', 'Utility']
		]);
	}

	/**
	 * Registers the default commands to the registry
	 * @param {Object} [options] - Object specifying what commands to register
	 * @param {boolean} [options.help=true] - Whether or not to register the built-in help command
	 * @param {boolean} [options.prefix=true] - Whether or not to register the built-in prefix command
	 * @param {boolean} [options.eval_=true] - Whether or not to register the built-in eval command
	 * @param {boolean} [options.ping=true] - Whether or not to register the built-in ping command
	 * @param {boolean} [options.commandState=true] - Whether or not to register the built-in command state commands
	 * (enable, disable, reload, list groups)
	 * @return {CommandRegistry}
	 */
	public registerDefaultCommands({ help = true, prefix = true, ping = true, eval_ = true, commandState = true } = {}): CommandRegistry {
		if (help) this.registerCommand(require('../commands/commands/util/help'));
		if (prefix) this.registerCommand(require('../commands/commands/util/prefix'));
		if (ping) this.registerCommand(require('../commands/commands/util/ping'));
		if (eval_) this.registerCommand(require('../commands/commands/util/eval'));
		if (commandState) {
			this.registerCommands([
				require('../commands/commands/disable'),
				require('../commands/commands/enable'),
				require('../commands/commands/groups'),
				require('../commands/commands/load'),
				require('../commands/commands/reload'),
				require('../commands/commands/unload')
			]);
		}
		return this;
	}

	/**
	 * Registers the default argument types to the registry. These are:
	 * * string
	 * * integer
	 * * float
	 * * boolean
	 * * user
	 * * member
	 * * role
	 * * channel
	 * * message
	 * @return {CommandRegistry}
	 */
	public registerDefaultTypes(): CommandRegistry {
		this.registerTypes([
			require('../argumenttypes/BooleanType'),
			require('../argumenttypes/ChannelType'),
			require('../argumenttypes/FloatType'),
			require('../argumenttypes/IntegerType'),
			require('../argumenttypes/MemberType'),
			require('../argumenttypes/MessageType'),
			require('../argumenttypes/RoleType'),
			require('../argumenttypes/StringType'),
			require('../argumenttypes/UserType')
		]);
		return this;
	}

	/**
	 * Reregisters a command (does not support changing name, group, or memberName)
	 * @param {BaseCommand|Function} command - New command
	 * @param {BaseCommand} oldCommand - Old command
	 */
	public reregisterCommand(command: BaseCommand | (() => BaseCommand), oldCommand: BaseCommand): void {
		if (typeof command === 'function') command = command();
		if (command.name !== oldCommand.name) throw new Error('Command name cannot change.');
		if (command.groupID !== oldCommand.groupID) throw new Error('Command group cannot change.');
		if (command.memberName !== oldCommand.memberName) throw new Error('Command memberName cannot change.');
		command.group = this.resolveGroup(command.groupID);
		command.group.commands.set(command.name, command);
		this.commands.set(command.name, command);
		/**
		 * Emitted when a command is reregistered
		 * @event UntitledClient#commandReregister
		 * @param {BaseCommand} newCommand - New command
		 * @param {BaseCommand} oldCommand - Old command
		 */
		this.client.emit('commandReregister', command, oldCommand);
		this.client.emit('debug', `Reregistered command ${command.groupID}:${command.memberName}.`);
	}

	/**
	 * Unregisters a command
	 * @param {BaseCommand} command - Command to unregister
	 */
	public unregisterCommand(command: BaseCommand): void {
		this.commands.delete(command.name);
		command.group.commands.delete(command.name);
		/**
		 * Emitted when a command is unregistered
		 * @event UntitledClient#commandUnregister
		 * @param {BaseCommand} command - Command that was unregistered
		 */
		this.client.emit('commandUnregister', command);
		this.client.emit('debug', `Unregistered command ${command.groupID}:${command.memberName}.`);
	}

	/**
	 * Registers a single object to be usable by the eval command
	 * @param {string} key - The key for the object
	 * @param {Object} obj - The object
	 * @return {CommandRegistry}
	 * @see {@link CommandRegistry#registerEvalObjects}
	 */
	public registerEvalObject(key: string, obj: object): CommandRegistry {
		const registerObj: { [index: string]: object } = {};
		registerObj[key] = obj;
		return this.registerEvalObjects(registerObj);
	}

	/**
	 * Registers multiple objects to be usable by the eval command
	 * @param {Object} obj - An object of keys: values
	 * @return {CommandRegistry}
	 */
	public registerEvalObjects(obj: object): CommandRegistry {
		Object.assign(this.evalObjects, obj);
		return this;
	}

	/**
	 * Finds all groups that match the search string
	 * @param {string} [searchString] - The string to search for
	 * @param {boolean} [exact=false] - Whether the search should be exact
	 * @return {BaseCommandGroup[]|Collection<string, BaseCommandGroup>} All groups that are found
	 */
	public findGroups(searchString: string = null, exact: boolean = false): BaseCommandGroup[] | Collection<string, BaseCommandGroup> {
		if (!searchString) return this.groups;

		// Find all matches
		const lcSearch: string = searchString.toLowerCase();
		const matchedGroups: BaseCommandGroup[] = this.groups.filterArray(
			exact ? groupFilterExact(lcSearch) : groupFilterInexact(lcSearch)
		);
		if (exact) return matchedGroups;

		// See if there's an exact match
		for (const group of matchedGroups) {
			if (group.name.toLowerCase() === lcSearch || group.id === lcSearch) return [group];
		}
		return matchedGroups;
	}

	/**
	 * Resolves a CommandGroupResolvable to a CommandGroup object
	 * @param {CommandGroupResolvable} group - The group to resolve
	 * @return {BaseCommandGroup} The resolved CommandGroup
	 */
	public resolveGroup(group: CommandGroupResolvable): BaseCommandGroup {
		if (group instanceof BaseCommandGroup) return group;
		if (typeof group === 'string') {
			const groups: BaseCommandGroup[] | Collection<string, BaseCommandGroup> = this.findGroups(group, true);
			if ((groups as BaseCommandGroup[]).length === 1) return (groups as BaseCommandGroup[])[0];
		}
		throw new Error('Unable to resolve group.');
	}

	/**
	 * Finds all commands that match the search string
	 * @param {string} [searchString] - The string to search for
	 * @param {boolean} [exact=false] - Whether the search should be exact
	 * @param {BaseMessage} [message] - The message to check usability against
	 * @return {BaseCommand[]|Collection<string, BaseCommand>} All commands that are found
	 */
	public findCommands(searchString: string = null, exact: boolean = false, message: BaseMessage = null): BaseCommand[] | Collection<string, BaseCommand> {
		if (!searchString) return message ? this.commands.filterArray((cmd: BaseCommand) => cmd.isUsable(message)) : this.commands;

		// Find all matches
		const lcSearch: string = searchString.toLowerCase();
		const matchedCommands: BaseCommand[] = this.commands.filterArray(
			exact ? commandFilterExact(lcSearch) : commandFilterInexact(lcSearch)
		);
		if (exact) return matchedCommands;

		// See if there's an exact match
		for (const command of matchedCommands) {
			if (command.name === lcSearch || (command.aliases && command.aliases.some((ali: string) => ali === lcSearch))) {
				return [command];
			}
		}

		return matchedCommands;
	}

	/**
	 * Resolves a CommandResolvable to a Command object
	 * @param {CommandResolvable} command - The command to resolve
	 * @return {BaseCommand} The resolved Command
	 */
	public resolveCommand(command: CommandResolvable): BaseCommand {
		if (command instanceof BaseCommand) return command;
		if (command instanceof BaseMessage) return command.command;
		if (typeof command === 'string') {
			const commands: BaseCommand[] | Collection<string, BaseCommand> = this.findCommands(command, true);
			if ((commands as BaseCommand[]).length === 1) return (commands as BaseCommand[])[0];
		}
		throw new Error('Unable to resolve command.');
	}

	/**
	 * Resolves a command file path from a command's group ID and memberName
	 * @param {string} group - ID of the command's group
	 * @param {string} memberName - Member name of the command
	 * @return {string} Fully-resolved path to the corresponding command file
	 */
	public resolveCommandPath(group: string, memberName: string): string {
		return path.join(this.commandsPath, group, `${memberName}.js`);
	}
}

function groupFilterExact(search: string) {
	return (grp: BaseCommandGroup) => grp.id === search || grp.name.toLowerCase() === search;
}

function groupFilterInexact(search: string) {
	return (grp: BaseCommandGroup) => grp.id.includes(search) || grp.name.toLowerCase().includes(search);
}

function commandFilterExact(search: string) {
	return (cmd: BaseCommand) => cmd.name === search ||
		(cmd.aliases && cmd.aliases.some((ali: string) => ali === search)) ||
		`${cmd.groupID}:${cmd.memberName}` === search;
}

function commandFilterInexact(search: string) {
	return (cmd: BaseCommand) => cmd.name.includes(search) ||
		`${cmd.groupID}:${cmd.memberName}` === search ||
		(cmd.aliases && cmd.aliases.some((ali: string) => ali.includes(search)));
}
