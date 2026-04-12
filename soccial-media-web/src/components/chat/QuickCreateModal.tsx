type Props = {
  isOpen: boolean;
  onClose: () => void;
  directUserIdInput: string;
  setDirectUserIdInput: (v: string) => void;
  groupNameInput: string;
  setGroupNameInput: (v: string) => void;
  groupMemberIdsInput: string;
  setGroupMemberIdsInput: (v: string) => void;
  onCreateDirect: () => void;
  onCreateGroup: () => void;
};

export function QuickCreateModal({
  isOpen,
  onClose,
  directUserIdInput,
  setDirectUserIdInput,
  groupNameInput,
  setGroupNameInput,
  groupMemberIdsInput,
  setGroupMemberIdsInput,
  onCreateDirect,
  onCreateGroup,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Tạo hội thoại nhanh</h3>
          <button
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
            type="button"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="User ID chat 1-1"
            value={directUserIdInput}
            onChange={(e) => setDirectUserIdInput(e.target.value)}
          />
          <button
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            type="button"
            onClick={onCreateDirect}
          >
            Tạo chat 1-1
          </button>

          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Tên nhóm"
            value={groupNameInput}
            onChange={(e) => setGroupNameInput(e.target.value)}
          />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Member IDs: 2,3,4"
            value={groupMemberIdsInput}
            onChange={(e) => setGroupMemberIdsInput(e.target.value)}
          />
        </div>
        <button
          className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          type="button"
          onClick={onCreateGroup}
        >
          Tạo nhóm
        </button>
      </div>
    </div>
  );
}
