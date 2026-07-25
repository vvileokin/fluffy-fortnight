import { redirect } from "next/navigation";

// The overview section is gone (its stats and "recent activity" were mock data),
// so /admin lands on the first real section instead.
export default function AdminIndex() {
  redirect("/admin/matches");
}
