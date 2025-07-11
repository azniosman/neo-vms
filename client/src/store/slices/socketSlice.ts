import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { io, Socket } from 'socket.io-client';
import { RootState } from '../index';

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  connectionError: string | null;
  lastMessage: any;
  activeUsers: string[];
  notifications: any[];
}

const initialState: SocketState = {
  socket: null,
  connected: false,
  connectionError: null,
  lastMessage: null,
  activeUsers: [],
  notifications: [],
};

export const initializeSocket = createAsyncThunk(
  'socket/initialize',
  async (_, { getState }) => {
    const state = getState() as RootState;
    const token = state.auth.accessToken;
    
    if (!token) {
      throw new Error('No access token available');
    }

    const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:3001', {
      auth: {
        token,
      },
      transports: ['websocket'],
    });

    return new Promise<Socket>((resolve, reject) => {
      socket.on('connect', () => {
        resolve(socket);
      });

      socket.on('connect_error', (error) => {
        reject(error);
      });

      socket.on('error', (error) => {
        reject(error);
      });

      // Set up event listeners
      socket.on('notification', (data) => {
        // Handle notification in component
      });

      socket.on('visitor_arrived', (data) => {
        // Handle visitor arrival
      });

      socket.on('visitor_departed', (data) => {
        // Handle visitor departure
      });

      socket.on('emergency_notification', (data) => {
        // Handle emergency notification
      });

      socket.on('occupancy_changed', (data) => {
        // Handle occupancy change
      });

      socket.on('visit_status_changed', (data) => {
        // Handle visit status change
      });

      socket.on('system_message', (data) => {
        // Handle system message
      });
    });
  }
);

export const disconnectSocket = createAsyncThunk(
  'socket/disconnect',
  async (_, { getState }) => {
    const state = getState() as RootState;
    const socket = state.socket.socket;
    
    if (socket) {
      socket.disconnect();
    }
  }
);

export const sendMessage = createAsyncThunk(
  'socket/sendMessage',
  async ({ event, data }: { event: string; data: any }, { getState }) => {
    const state = getState() as RootState;
    const socket = state.socket.socket;
    
    if (socket && socket.connected) {
      socket.emit(event, data);
    } else {
      throw new Error('Socket not connected');
    }
  }
);

export const joinRoom = createAsyncThunk(
  'socket/joinRoom',
  async (room: string, { getState }) => {
    const state = getState() as RootState;
    const socket = state.socket.socket;
    
    if (socket && socket.connected) {
      socket.emit('join_room', room);
    }
  }
);

export const leaveRoom = createAsyncThunk(
  'socket/leaveRoom',
  async (room: string, { getState }) => {
    const state = getState() as RootState;
    const socket = state.socket.socket;
    
    if (socket && socket.connected) {
      socket.emit('leave_room', room);
    }
  }
);

const socketSlice = createSlice({
  name: 'socket',
  initialState,
  reducers: {
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.connected = action.payload;
    },
    setConnectionError: (state, action: PayloadAction<string | null>) => {
      state.connectionError = action.payload;
    },
    setLastMessage: (state, action: PayloadAction<any>) => {
      state.lastMessage = action.payload;
    },
    addNotification: (state, action: PayloadAction<any>) => {
      state.notifications.push(action.payload);
      // Keep only last 100 notifications
      if (state.notifications.length > 100) {
        state.notifications.shift();
      }
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    setActiveUsers: (state, action: PayloadAction<string[]>) => {
      state.activeUsers = action.payload;
    },
    addActiveUser: (state, action: PayloadAction<string>) => {
      if (!state.activeUsers.includes(action.payload)) {
        state.activeUsers.push(action.payload);
      }
    },
    removeActiveUser: (state, action: PayloadAction<string>) => {
      state.activeUsers = state.activeUsers.filter(user => user !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeSocket.pending, (state) => {
        state.connectionError = null;
      })
      .addCase(initializeSocket.fulfilled, (state, action) => {
        state.socket = action.payload as any;
        state.connected = true;
        state.connectionError = null;
      })
      .addCase(initializeSocket.rejected, (state, action) => {
        state.socket = null;
        state.connected = false;
        state.connectionError = action.error.message || 'Socket connection failed';
      })
      .addCase(disconnectSocket.fulfilled, (state) => {
        state.socket = null;
        state.connected = false;
        state.connectionError = null;
        state.activeUsers = [];
      });
  },
});

export const {
  setConnected,
  setConnectionError,
  setLastMessage,
  addNotification,
  clearNotifications,
  setActiveUsers,
  addActiveUser,
  removeActiveUser,
} = socketSlice.actions;

export default socketSlice.reducer;