import { CreateTicketForm } from "@/components/tickets/create-ticket-form";

export default function CreateTicketPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Create Ticket
        </h2>
        <p className="text-slate-500">
          Submit a new support request to our team.
        </p>
      </div>
      <CreateTicketForm />
    </div>
  );
}
