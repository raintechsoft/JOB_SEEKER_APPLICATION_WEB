import { resetOrganizationDrafts } from "@/features/organization/draft-store";
import { useUiStore } from "@/stores/ui-store";
import { modal } from "@/stores/modal-store";
import {resetMessageDrafts} from "@/features/messaging/draft-store";
import {uploadManager} from "@/services/media/upload-manager";

/** Drop all in-memory user/workspace drafts when changing authenticated identity. */
export function clearIdentityState() {
  uploadManager.clear();
  resetOrganizationDrafts();
  resetMessageDrafts();
  useUiStore.setState(useUiStore.getInitialState(), true);
  modal.close();
}
