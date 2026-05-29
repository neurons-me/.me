import { ME } from './me.js';
import { MEOptions } from './types.js';
export interface ThisMeInit {
    name?: string;
    space?: string;
    namespace?: string;
    displayName?: string;
    seed?: string;
    options?: MEOptions;
}
export type ThisMeInput = string | ThisMeInit | undefined;
export declare function createThisMe(input?: ThisMeInput, options?: MEOptions): ME;
