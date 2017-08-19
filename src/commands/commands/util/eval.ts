import { UntitledClient, BaseCommand, BaseCommandGroup, BaseCommandDecorators, BaseMessage } from '../../../';
import { stripIndents } from 'common-tags';
import { Message, Util } from 'discord.js';
import * as util from 'util';

const escapeRegex = require('escape-string-regexp');

const { name, group, memberName, description, details, property, args } = BaseCommandDecorators;

const nl = '!!NL!!';
const nlPattern = new RegExp(nl, 'g');

@name('eval')
@group('util')
@memberName('eval')
@description('Executes JavaScript code.')
@details('Only the bot owner(s) may use this command.')
@property('lastResult', null)
@property('hrStart', null)
@property('_sensitivePattern', null)
export class EvalCommand extends BaseCommand {
	public lastResult: any;
	public hrStart: [number, number];
	private _sensitivePattern: RegExp;

	hasPermission(msg: BaseMessage) {
		return this.client.isOwner(msg.author);
	}

	@args({
		key: 'script',
		prompt: 'what code would you like to evaluate?\n',
		type: 'string'
	})
	public async run(msg: BaseMessage, { script }: { script: string }): Promise<Message | Message[]> {
		const message: BaseMessage = msg;
		const client: UntitledClient = msg.client;
		const objects: object = client.registry.evalObjects;
		const lastResult: any = this.lastResult;
		const doReply: (val: string) => void = (val: any) => {
			if (val instanceof Error) {
				msg.reply(`Callback error: \`${val}\``);
			} else {
				const result = this.makeResultMessages(val, process.hrtime(this.hrStart));
				if (Array.isArray(result)) {
					for (const item of result) {
						if (this.client.options.selfbot) msg.say(item);
						else msg.reply(item);
					}
				} else if (this.client.options.selfbot) {
					msg.say(result);
				} else {
					msg.reply(result);
				}
			}
		};

		let hrDiff: [number, number];
		try {
			const hrStart: [number, number] = process.hrtime();
			// tslint:disable-next-line:no-eval
			this.lastResult = eval(script);
			hrDiff = process.hrtime(hrStart);
		} catch (err) {
			return msg.reply(`Error while evaluating: \`${err}\``);
		}

		this.hrStart = process.hrtime();
		let response = this.makeResultMessages(this.lastResult, hrDiff, script, msg.editable);
		if (msg.editable) {
			if (response instanceof Array) {
				if (response.length > 0) response = response.slice(1, response.length - 1);
				for (const resp of response) msg.say(resp);
				return null;
			} else {
				return msg.edit(response);
			}
		} else {
			return msg.reply(response);
		}
	}

	makeResultMessages(result: any, hrDiff: [number, number], input: string = null, editable: boolean = false): string | string[] {
		const inspected: string = util.inspect(result, { depth: 0 })
			.replace(nlPattern, '\n')
			.replace(this.sensitivePattern, '--snip--');
		const split: string[] = inspected.split('\n');
		const last: number = inspected.length - 1;
		const prependPart: string = inspected[0] !== '{' && inspected[0] !== '[' && inspected[0] !== '\'' ? split[0] : inspected[0];
		const appendPart: string = inspected[last] !== '}' && inspected[last] !== ']' && inspected[last] !== '\'' ?
			split[split.length - 1] :
			inspected[last];
		const prepend = `\`\`\`javascript\n${prependPart}\n`;
		const append = `\n${appendPart}\n\`\`\``;
		if (input) {
			return Util.splitMessage(stripIndents`
				${editable ? `
					*Input*
					\`\`\`javascript
					${input}
					\`\`\`` :
				''}
				*Executed in ${hrDiff[0] > 0 ? `${hrDiff[0]}s ` : ''}${hrDiff[1] / 1000000}ms.*
				\`\`\`javascript
				${inspected}
				\`\`\`
			`, { maxLength: 1900, char: '\n', prepend, append });
		} else {
			return Util.splitMessage(stripIndents`
				*Callback executed after ${hrDiff[0] > 0 ? `${hrDiff[0]}s ` : ''}${hrDiff[1] / 1000000}ms.*
				\`\`\`javascript
				${inspected}
				\`\`\`
			`, { maxLength: 1900, char: '\n', prepend, append });
		}
	}

	get sensitivePattern() {
		if (!this._sensitivePattern) {
			const client: UntitledClient = this.client;
			let pattern = '';
			if (client.token) pattern += escapeRegex(client.token);
			Object.defineProperty(this, '_sensitivePattern', { value: new RegExp(pattern, 'gi') });
		}
		return this._sensitivePattern;
	}
}
