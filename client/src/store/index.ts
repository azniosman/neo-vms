import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { combineReducers } from '@reduxjs/toolkit';

import authSlice from './slices/authSlice';
import visitorSlice from './slices/visitorSlice';
import visitSlice from './slices/visitSlice';
import userSlice from './slices/userSlice';
import notificationSlice from './slices/notificationSlice';
import socketSlice from './slices/socketSlice';
import settingsSlice from './slices/settingsSlice';

const rootReducer = combineReducers({
  auth: authSlice,
  visitors: visitorSlice,
  visits: visitSlice,
  users: userSlice,
  notifications: notificationSlice,
  socket: socketSlice,
  settings: settingsSlice,
});

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth', 'settings'], // Only persist auth and settings
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;