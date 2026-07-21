import React, { useState } from 'react';
import { User, Shield, Volume2, Key, LogOut, Upload, ArrowLeft } from 'lucide-react';
import { api } from '../../../context/AuthContext';
import { MobileHeader } from '../Shared/MobileHeader';

interface MobileSettingsScreenProps {
  user: any;
  logout: () => void;
  getAbsoluteUrl: (url: string) => string;
  
  // Profile settings
  displayNameInput: string;
  setDisplayNameInput: (val: string) => void;
  usernameInput: string;
  setUsernameInput: (val: string) => void;
  bioInput: string;
  setBioInput: (val: string) => void;
  avatarUrlInput: string;
  setAvatarUrlInput: (val: string) => void;
  isUploadingAvatar: boolean;
  setIsUploadingAvatar: (val: boolean) => void;
  saveProfile: (e: React.FormEvent) => Promise<void>;

  // Passwords
  currentPasswordInput: string;
  setCurrentPasswordInput: (val: string) => void;
  newPasswordInput: string;
  setNewPasswordInput: (val: string) => void;
  confirmPasswordInput: string;
  setConfirmPasswordInput: (val: string) => void;

  // Preferences
  whoCanSendFriendRequests: string;
  whoCanCallMe: string;
  whoCanSeeProfilePhoto: string;
  whoCanSeeLastSeen: string;
  updatePreference: (key: string, value: any) => Promise<void>;

  // Sounds
  enableRingtone: boolean;
  setEnableRingtone: (val: boolean) => void;
  enableCallertone: boolean;
  setEnableCallertone: (val: boolean) => void;
  enableMessageSounds: boolean;
  setEnableMessageSounds: (val: boolean) => void;
  soundVolume: number;
  setSoundVolume: (val: number) => void;
}

export const MobileSettingsScreen: React.FC<MobileSettingsScreenProps> = ({
  user,
  logout,
  getAbsoluteUrl,
  displayNameInput,
  setDisplayNameInput,
  usernameInput,
  setUsernameInput,
  bioInput,
  setBioInput,
  avatarUrlInput,
  setAvatarUrlInput,
  isUploadingAvatar,
  setIsUploadingAvatar,
  saveProfile,
  currentPasswordInput,
  setCurrentPasswordInput,
  newPasswordInput,
  setNewPasswordInput,
  confirmPasswordInput,
  setConfirmPasswordInput,
  whoCanSendFriendRequests,
  whoCanCallMe,
  whoCanSeeProfilePhoto,
  whoCanSeeLastSeen,
  updatePreference,
  enableRingtone,
  setEnableRingtone,
  enableCallertone,
  setEnableCallertone,
  enableMessageSounds,
  setEnableMessageSounds,
  soundVolume,
  setSoundVolume
}) => {
  const [section, setSection] = useState<'menu' | 'profile' | 'privacy' | 'sounds' | 'security'>('menu');

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAvatarUrlInput(response.data.fileUrl);
      alert('Photo uploaded! Tap "Save Changes" at the bottom to apply.');
    } catch (err: any) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProfile(e);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
      alert('Please fill in all password fields.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      alert('Passwords do not match.');
      return;
    }
    try {
      await api.post('/auth/change-password', {
        currentPassword: currentPasswordInput,
        newPassword: newPasswordInput
      });
      alert('Password changed successfully.');
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setSection('menu');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Password update failed.');
    }
  };

  if (section === 'profile') {
    return (
      <div className="fixed inset-0 bg-dark-bg z-30 flex flex-col select-none animate-fade-in">
        <MobileHeader
          title="Edit Profile"
          leftAction={
            <button onClick={() => setSection('menu')} className="p-2.5 rounded-xl hover:bg-white/5 text-dark-muted hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
          }
        />
        <form onSubmit={handleProfileSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/10 relative group">
              <img
                src={getAbsoluteUrl(avatarUrlInput) || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username}`}
                alt="Profile avatar"
                className="w-full h-full object-cover"
              />
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[10px] text-white">
                  Uploading...
                </div>
              )}
            </div>
            <label className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl border border-white/10 cursor-pointer flex items-center space-x-1.5 min-h-[36px]">
              <Upload size={14} />
              <span>{isUploadingAvatar ? 'Uploading...' : 'Change Photo'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploadingAvatar} />
            </label>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-dark-muted uppercase tracking-wider">Display Name</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 rounded-xl bg-dark-surface border border-white/5 text-xs text-white focus:outline-none focus:border-brand-500/50"
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-dark-muted uppercase tracking-wider">Username</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 rounded-xl bg-dark-surface border border-white/5 text-xs text-white focus:outline-none focus:border-brand-500/50"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-dark-muted uppercase tracking-wider">Bio Status</label>
              <textarea
                rows={3}
                maxLength={255}
                className="w-full px-4 py-3 rounded-xl bg-dark-surface border border-white/5 text-xs text-white focus:outline-none focus:border-brand-500/50 resize-none"
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value)}
                placeholder="Write a bio..."
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-lg hover:shadow-brand-500/20 transition-all min-h-[44px]"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (section === 'privacy') {
    return (
      <div className="fixed inset-0 bg-dark-bg z-30 flex flex-col select-none animate-fade-in">
        <MobileHeader
          title="Privacy Settings"
          leftAction={
            <button onClick={() => setSection('menu')} className="p-2.5 rounded-xl hover:bg-white/5 text-dark-muted hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
          }
        />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-dark-surface/40 border border-white/5 space-y-4">
              <div className="flex flex-col space-y-1.5">
                <span className="text-[10px] font-bold text-dark-muted uppercase tracking-wider">Who can send friend requests</span>
                <select
                  value={whoCanSendFriendRequests}
                  onChange={(e) => updatePreference('whoCanSendFriendRequests', e.target.value)}
                  className="w-full bg-dark-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none min-h-[40px]"
                >
                  <option value="EVERYONE">Everyone</option>
                  <option value="FRIENDS">Mutual Friends</option>
                  <option value="NOONE">No one</option>
                </select>
              </div>

              <div className="flex flex-col space-y-1.5">
                <span className="text-[10px] font-bold text-dark-muted uppercase tracking-wider">Who can call me</span>
                <select
                  value={whoCanCallMe}
                  onChange={(e) => updatePreference('whoCanCallMe', e.target.value)}
                  className="w-full bg-dark-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none min-h-[40px]"
                >
                  <option value="EVERYONE">Everyone</option>
                  <option value="FRIENDS">Friends</option>
                  <option value="NOONE">No one</option>
                </select>
              </div>

              <div className="flex flex-col space-y-1.5">
                <span className="text-[10px] font-bold text-dark-muted uppercase tracking-wider">Who can see profile photo</span>
                <select
                  value={whoCanSeeProfilePhoto}
                  onChange={(e) => updatePreference('whoCanSeeProfilePhoto', e.target.value)}
                  className="w-full bg-dark-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none min-h-[40px]"
                >
                  <option value="EVERYONE">Everyone</option>
                  <option value="FRIENDS">Friends</option>
                  <option value="NOONE">No one</option>
                </select>
              </div>

              <div className="flex flex-col space-y-1.5">
                <span className="text-[10px] font-bold text-dark-muted uppercase tracking-wider">Who can see last seen</span>
                <select
                  value={whoCanSeeLastSeen}
                  onChange={(e) => updatePreference('whoCanSeeLastSeen', e.target.value)}
                  className="w-full bg-dark-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none min-h-[40px]"
                >
                  <option value="EVERYONE">Everyone</option>
                  <option value="FRIENDS">Friends</option>
                  <option value="NOONE">No one</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'sounds') {
    return (
      <div className="fixed inset-0 bg-dark-bg z-30 flex flex-col select-none animate-fade-in">
        <MobileHeader
          title="Sounds & Alerts"
          leftAction={
            <button onClick={() => setSection('menu')} className="p-2.5 rounded-xl hover:bg-white/5 text-dark-muted hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
          }
        />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="p-4 rounded-2xl bg-dark-surface/40 border border-white/5 space-y-5">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-bold text-dark-muted uppercase tracking-wider">
                <span>Ringtone Volume</span>
                <span>{(soundVolume * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={soundVolume}
                onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
            </div>

            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <span className="text-xs font-semibold text-white">Call Ringtone Alerts</span>
              <input
                type="checkbox"
                checked={enableRingtone}
                onChange={(e) => setEnableRingtone(e.target.checked)}
                className="w-4 h-4 rounded accent-brand-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <span className="text-xs font-semibold text-white">Outbound Dialertone</span>
              <input
                type="checkbox"
                checked={enableCallertone}
                onChange={(e) => setEnableCallertone(e.target.checked)}
                className="w-4 h-4 rounded accent-brand-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-semibold text-white">Message Sound Alerts</span>
              <input
                type="checkbox"
                checked={enableMessageSounds}
                onChange={(e) => setEnableMessageSounds(e.target.checked)}
                className="w-4 h-4 rounded accent-brand-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'security') {
    return (
      <div className="fixed inset-0 bg-dark-bg z-30 flex flex-col select-none animate-fade-in">
        <MobileHeader
          title="Change Password"
          leftAction={
            <button onClick={() => setSection('menu')} className="p-2.5 rounded-xl hover:bg-white/5 text-dark-muted hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
          }
        />
        <form onSubmit={handlePasswordSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-dark-muted uppercase tracking-wider block">Current Password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 rounded-xl bg-dark-surface border border-white/5 text-xs text-white focus:outline-none focus:border-brand-500/50"
                value={currentPasswordInput}
                onChange={(e) => setCurrentPasswordInput(e.target.value)}
                placeholder="Current Password"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-dark-muted uppercase tracking-wider block">New Password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 rounded-xl bg-dark-surface border border-white/5 text-xs text-white focus:outline-none focus:border-brand-500/50"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="New Password (min 6 characters)"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-dark-muted uppercase tracking-wider block">Confirm New Password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 rounded-xl bg-dark-surface border border-white/5 text-xs text-white focus:outline-none focus:border-brand-500/50"
                value={confirmPasswordInput}
                onChange={(e) => setConfirmPasswordInput(e.target.value)}
                placeholder="Confirm New Password"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-lg transition-all min-h-[44px]"
            >
              Update Password
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-dark-bg overflow-y-auto p-6 space-y-6 scrollbar-none">
      {/* Profile summary card */}
      <div className="w-full p-5 rounded-3xl bg-dark-surface/40 backdrop-blur-xl border border-white/5 flex items-center space-x-4">
        <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 shrink-0">
          <img
            src={getAbsoluteUrl(user?.profile?.avatarUrl) || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username}`}
            alt="Avatar"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0 text-left">
          <h2 className="text-base font-bold text-white truncate leading-tight">
            {user?.profile?.displayName || user?.username}
          </h2>
          <p className="text-xs text-dark-muted mt-0.5 truncate">@{user?.username}</p>
          {user?.profile?.bio && (
            <p className="text-[10px] text-dark-muted italic mt-1.5 truncate">
              "{user.profile.bio}"
            </p>
          )}
        </div>
      </div>

      {/* Menu Options */}
      <div className="p-2.5 rounded-3xl bg-dark-surface/40 backdrop-blur-xl border border-white/5 space-y-1">
        <button
          onClick={() => {
            setDisplayNameInput(user?.profile?.displayName || '');
            setBioInput(user?.profile?.bio || '');
            setAvatarUrlInput(user?.profile?.avatarUrl || '');
            setUsernameInput(user?.username || '');
            setSection('profile');
          }}
          className="w-full p-3.5 rounded-2xl hover:bg-white/5 flex items-center justify-between text-left transition-all"
        >
          <div className="flex items-center space-x-3.5 text-white">
            <User size={18} className="text-brand-400" />
            <span className="text-xs font-semibold">Account Profile</span>
          </div>
          <span className="text-[10px] text-dark-muted font-bold uppercase select-none">Edit</span>
        </button>

        <button
          onClick={() => setSection('privacy')}
          className="w-full p-3.5 rounded-2xl hover:bg-white/5 flex items-center justify-between text-left transition-all"
        >
          <div className="flex items-center space-x-3.5 text-white">
            <Shield size={18} className="text-brand-400" />
            <span className="text-xs font-semibold">Privacy Preferences</span>
          </div>
          <span className="text-[10px] text-dark-muted font-bold uppercase select-none">Configure</span>
        </button>

        <button
          onClick={() => setSection('sounds')}
          className="w-full p-3.5 rounded-2xl hover:bg-white/5 flex items-center justify-between text-left transition-all"
        >
          <div className="flex items-center space-x-3.5 text-white">
            <Volume2 size={18} className="text-brand-400" />
            <span className="text-xs font-semibold">Sounds & Audio Configuration</span>
          </div>
          <span className="text-[10px] text-dark-muted font-bold uppercase select-none">Adjust</span>
        </button>

        <button
          onClick={() => {
            setCurrentPasswordInput('');
            setNewPasswordInput('');
            setConfirmPasswordInput('');
            setSection('security');
          }}
          className="w-full p-3.5 rounded-2xl hover:bg-white/5 flex items-center justify-between text-left transition-all"
        >
          <div className="flex items-center space-x-3.5 text-white">
            <Key size={18} className="text-brand-400" />
            <span className="text-xs font-semibold">Change Password</span>
          </div>
          <span className="text-[10px] text-dark-muted font-bold uppercase select-none">Security</span>
        </button>
      </div>

      {/* Logout Action */}
      <div className="pt-2">
        <button
          onClick={logout}
          className="w-full p-3.5 rounded-2xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/10 text-red-400 font-bold text-xs flex items-center justify-center space-x-2 transition-all min-h-[44px]"
        >
          <LogOut size={16} />
          <span>Sign Out Account</span>
        </button>
      </div>

      {/* App Version Info */}
      <div className="text-center pt-4">
        <p className="text-[10px] text-dark-muted font-semibold tracking-wide uppercase">Velvet Chat client</p>
        <p className="text-[9px] text-dark-muted/60 font-semibold mt-0.5">Version 0.1.0 (v0.1.0 Release Candidate)</p>
      </div>
    </div>
  );
};

export default MobileSettingsScreen;
