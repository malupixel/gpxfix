export function managementModalCanContinue(copySucceeded: boolean, clipboardFailed: boolean, manualConfirmed: boolean): boolean {
  return copySucceeded || (clipboardFailed && manualConfirmed);
}
