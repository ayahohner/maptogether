/** What can't be in a name written without backticks, or where it can't be. */
const NEEDS_BACKTICKS = /--|\/\/|[[\]{};"`\r\n]|^[@\s]|\s$/;

/** Whether `name` can be written as a component's name as it is, without backticks. */
export const isComponentName = (name: string) => name !== "" && !NEEDS_BACKTICKS.test(name);

/** `name` as the text writes it: in backticks if it needs them. */
export const writeName = (name: string) => (isComponentName(name) ? name : `\`${name}\``);
