// Types for Whatsify WhatsApp Account Manager

export interface WaAccount {
  id: string;
  createdAt: string;
  number: string;
  uniqueId: string;
  allowIncoming: boolean;
  status: "Connected" | "Disconnected";
}

export interface WalletInfo {
  currency: string;
  balance: number;
}

export interface UserInfo {
  name: string;
  role: string;
  businessName: string;
}

/**
 * Abstract messaging provider interface.
 * Connect to official WhatsApp Business Cloud API or any approved provider here.
 *
 * TODO: Replace MockMessagingProvider with an official implementation:
 *   - WhatsApp Business Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
 *   - Twilio WhatsApp API: https://www.twilio.com/en-us/whatsapp
 */
export interface MessagingProvider {
  /**
   * Send a WhatsApp message to the given phone number.
   * @param to - Recipient phone number in international format (e.g. "918595021137")
   * @param message - Text message to send
   */
  sendMessage(to: string, message: string): Promise<void>;

  /**
   * Retrieve all registered WhatsApp accounts.
   */
  getAccounts(): Promise<WaAccount[]>;

  /**
   * Reconnect a WhatsApp account by its unique ID.
   * @param id - The unique identifier of the account
   */
  reconnectAccount(id: string): Promise<void>;

  /**
   * Delete a WhatsApp account by its unique ID.
   * @param id - The unique identifier of the account
   */
  deleteAccount(id: string): Promise<void>;
}
