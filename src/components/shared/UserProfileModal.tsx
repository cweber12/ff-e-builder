import { useEffect, useState } from 'react';
import { useUpdateUserProfile, useUserProfile } from '../../hooks/shared/useUserProfile';
import { Button, Modal } from '../primitives';

export function UserProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: profile } = useUserProfile();
  const updateProfile = useUpdateUserProfile();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setEmail(profile.email);
    setPhone(profile.phone);
    setCompanyName(profile.companyName);
  }, [profile]);

  return (
    <Modal open={open} onClose={onClose} title="Update profile">
      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          updateProfile.mutate({ name, email, phone, companyName });
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Name
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Phone
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Company
          <input
            type="text"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <div className="flex justify-end gap-2 pt-2 md:col-span-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={updateProfile.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
