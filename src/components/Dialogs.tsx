import { ArrowRight, Heart, MessageCircle, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { FRIENDS } from '../lib/store';
import type { Friend } from '../lib/types';
import { Avatar, BrandMark, Modal } from './UI';

export function NewChatDialog({
  onSelect,
  onClose,
}: {
  onSelect: (friend: Friend) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title="Who’s your people today?"
      subtitle="Different energies. The same warm welcome."
      onClose={onClose}
    >
      <div className="new-chat-list">
        {FRIENDS.map((friend) => (
          <button key={friend.id} onClick={() => onSelect(friend)}>
            <Avatar friend={friend} size={53} />
            <span>
              <strong>
                {friend.name}
                <small>{friend.city}</small>
              </strong>
              <p>{friend.role}</p>
            </span>
            <ArrowRight size={19} />
          </button>
        ))}
      </div>
      <div className="modal-note">
        <Heart size={15} />
        You don’t need a reason. Just pick a friend.
      </div>
    </Modal>
  );
}
export function AboutDialog({
  onClose,
  onSettings,
}: {
  onClose: () => void;
  onSettings: () => void;
}) {
  return (
    <Modal
      title="A little about yaari"
      subtitle="Your people, always. A little AI, a lot of heart."
      onClose={onClose}
    >
      <div className="modal-body about-dialog">
        <BrandMark />
        <p>
          Four fictional Indian friends, each with a different way of showing up. A space for the
          everyday things you feel like sharing.
        </p>
        <div className="about-feature">
          <Sparkles size={21} />
          <div>
            <strong>Personality, not pretending</strong>
            <p>
              These are AI companions, not real people. Demo mode uses sample replies; live mode
              uses your configured AI provider.
            </p>
          </div>
        </div>
        <div className="about-feature">
          <ShieldCheck size={21} />
          <div>
            <strong>A companion, not a professional</strong>
            <p>
              Yaari isn’t medical, legal, or crisis support. For urgent help in India, call 112. For
              mental health support, call TELE-MANAS at 14416.
            </p>
          </div>
        </div>
        <div className="about-feature">
          <MessageCircle size={21} />
          <div>
            <strong>Your chats, your device</strong>
            <p>
              Conversations and attachments are stored in this browser. They aren’t end-to-end
              encrypted. Export anything you’d like to keep.
            </p>
          </div>
        </div>
        <button className="primary-button full-width" onClick={onSettings}>
          See profile & AI settings
          <ArrowRight size={16} />
        </button>
        <small className="about-credit">
          An independent, WhatsApp-inspired interface. Not affiliated with WhatsApp or Meta.
        </small>
      </div>
    </Modal>
  );
}
export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onClose,
  label = 'Clear conversation',
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onClose: () => void;
  label?: string;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="modal-body confirm-body">
        <span className="confirm-icon">
          <Trash2 size={25} />
        </span>
        <p>{description}</p>
      </div>
      <footer className="modal-footer">
        <button className="secondary-button" onClick={onClose}>
          Keep it
        </button>
        <button className="danger-button" onClick={onConfirm}>
          {label}
        </button>
      </footer>
    </Modal>
  );
}
