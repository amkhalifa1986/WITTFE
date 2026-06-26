import * as signalR from '@microsoft/signalr';
import api from './api';

class SignalRService {
  constructor() {
    this.connection = null;
    this.updateListeners = new Set();
    this.locationListeners = new Set();
    this.notificationListeners = new Set();
    this.connectingPromise = null;
  }

  async connect() {
    if (this.connectingPromise) {
      return this.connectingPromise;
    }
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return;
    }

    const token = api.accessToken;
    if (!token) {
      console.warn('SignalR: Cannot connect, no access token available');
      return;
    }

    this.connectingPromise = (async () => {
      if (!this.connection) {
        this.connection = new signalR.HubConnectionBuilder()
          .withUrl('http://localhost:5245/hubs/trip', {
            accessTokenFactory: () => api.accessToken,
            skipNegotiation: true, // Only if WebSockets is the only transport
            transport: signalR.HttpTransportType.WebSockets
          })
          .withAutomaticReconnect({
            nextRetryDelayInMilliseconds: (retryContext) => {
              const baseDelay = Math.min(30000, 1000 * Math.pow(2, retryContext.previousRetryCount));
              const jitter = Math.random() * 2000;
              return baseDelay + jitter;
            }
          })
          .withServerTimeout(30000)
          .withKeepAliveInterval(15000)
          .configureLogging(signalR.LogLevel.Warning) // Reduce logging noise
          .build();
          
        this.connection.onreconnecting(() => console.warn('SignalR reconnecting...'));
        this.connection.onreconnected(() => console.log('SignalR reconnected'));
        this.connection.onclose(() => console.error('SignalR disconnected'));

        this.connection.on('ReceiveUpdate', (update) => {
          this.updateListeners.forEach(listener => listener(update));
        });

        this.connection.on('ReceiveLocationUpdate', (locationUpdate) => {
          this.locationListeners.forEach(listener => listener(locationUpdate));
        });

        this.connection.on('ReceiveNotification', (notification) => {
          this.notificationListeners.forEach(listener => listener(notification));
        });
      }

      try {
        await this.connection.start();
        console.log('SignalR: Connected successfully');
      } catch (err) {
        console.error('SignalR: Connection failed', err);
        throw err;
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  registerListener(listener) {
    this.updateListeners.add(listener);
    return () => {
      this.updateListeners.delete(listener);
    };
  }

  registerLocationListener(listener) {
    this.locationListeners.add(listener);
    return () => {
      this.locationListeners.delete(listener);
    };
  }

  registerNotificationListener(listener) {
    this.notificationListeners.add(listener);
    return () => {
      this.notificationListeners.delete(listener);
    };
  }

  async joinTrip(tripId) {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      await this.connect();
    }
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      await this.connection.invoke('JoinTripGroup', tripId.toString());
      console.log(`SignalR: Joined trip group ${tripId}`);
    }
  }

  async leaveTrip(tripId) {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      await this.connection.invoke('LeaveTripGroup', tripId.toString());
      console.log(`SignalR: Left trip group ${tripId}`);
    }
  }

  async sendLiveUpdate(tripId, content, statusTag, latitude, longitude) {
    if (!this.connection) await this.connect();
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      await this.connection.invoke('SendLiveUpdate', tripId.toString(), content, statusTag, latitude, longitude);
      console.log('SignalR: Live update message sent');
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
      console.log('SignalR: Disconnected');
    }
  }
}

export const signalrService = new SignalRService();
export default signalrService;
