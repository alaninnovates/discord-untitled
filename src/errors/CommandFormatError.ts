import { BaseMessage, FriendlyError } from '../';

export class CommandFormatError extends FriendlyError {
	public name: string;

	/**
	 * @param {BaseMessage} msg - The command message the error is for
	 */
	public constructor(msg: BaseMessage) {
		super(
			`Invalid command format. Use ${msg.anyUsage(
				`help ${msg.command.name}`,
				msg.guild ? undefined : null,
				msg.guild ? undefined : null
			)} for information.
			`
		);
		this.name = 'CommandFormatError';
	}
}
