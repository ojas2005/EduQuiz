import { useState } from 'react';
import { BookOpen, Check, Coffee, Rocket, Sparkles, Sprout } from 'lucide-react';
import type { User } from '../types';
import { Alert, Button, Modal } from './UI';

const icons = { book: BookOpen, sparkles: Sparkles, sprout: Sprout, rocket: Rocket, coffee: Coffee };
export type ProfileData = Pick<User, 'name' | 'bio' | 'avatar'>;
export function Avatar({ user }: { user: Pick<User, 'name' | 'avatar'> }) {
  const Icon = icons[user.avatar as keyof typeof icons];
  return <span className="avatar" aria-hidden="true">{Icon ? <Icon size={21}/> : user.name.slice(0, 1).toUpperCase()}</span>;
}
export function ProfileEditor({ user, busy, onSave, onClose }: {
  user: User; busy: boolean; onSave: (data: ProfileData) => Promise<boolean>; onClose: () => void;
}) {
  const [name, setName] = useState(user.name), [bio, setBio] = useState(user.bio || ''), [avatar, setAvatar] = useState(user.avatar || 'initials');
  const [saved, setSaved] = useState(false), [failed, setFailed] = useState(false);
  const dirty = name.trim() !== user.name || bio.trim() !== (user.bio || '') || avatar !== (user.avatar || 'initials');
  return <Modal title="Make yourself at home." subtitle="A few details for your learning space." onClose={onClose} busy={busy}>
    {close => <form onChange={() => setSaved(false)} onSubmit={async event => { event.preventDefault(); setFailed(false); const ok = await onSave({ name: name.trim(), bio: bio.trim(), avatar }); setSaved(ok); setFailed(!ok); }}>
      <div className="profile-preview"><Avatar user={{ name: name.trim() || user.name, avatar }}/><div><strong>{name.trim() || user.name}</strong><small>{user.email}</small></div></div>
      <label htmlFor="profile-name">Display name</label><input id="profile-name" autoComplete="nickname" required maxLength={100} value={name} disabled={busy} onChange={event => setName(event.target.value)}/>
      <fieldset className="avatar-picker"><legend>Choose your icon</legend><div>{['initials', ...Object.keys(icons)].map(value => <button key={value} type="button" aria-label={value === 'initials' ? 'Your initial' : value} aria-pressed={avatar === value} disabled={busy} onClick={() => { setAvatar(value); setSaved(false); }}><Avatar user={{ name: name || user.name, avatar: value }}/></button>)}</div></fieldset>
      <label htmlFor="profile-bio">Bio <span className="optional-label">optional</span></label><textarea id="profile-bio" rows={3} maxLength={300} placeholder="Curious about…" value={bio} disabled={busy} onChange={event => setBio(event.target.value)} aria-describedby="bio-limit"/><small id="bio-limit">{bio.length}/300 characters</small>
      {saved && <Alert>Profile saved. Looking good.</Alert>}{failed && <Alert error>Couldn’t save your profile. Your edits are still here; please try again.</Alert>}
      <div className="button-row"><Button type="submit" disabled={busy || !name.trim() || !dirty}>{busy ? 'Saving…' : 'Save profile'}<Check size={17}/></Button><Button variant="ghost" disabled={busy} onClick={() => close()}>Done</Button></div>
    </form>}
  </Modal>;
}
