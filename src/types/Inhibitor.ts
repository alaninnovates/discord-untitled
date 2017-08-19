import { BaseMessage } from '../';

export type Inhibitor = (msg: BaseMessage) => string | [string, Promise<any>];
