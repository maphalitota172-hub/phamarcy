export function normalizeCustomerPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export function validateCustomerDetails(body) {
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  if (name.length < 2 || name.length > 100) return "Full name must be between 2 and 100 characters";
  if (!/^\+?[\d\s().-]+$/.test(phone) || normalizeCustomerPhone(phone).length < 7 || normalizeCustomerPhone(phone).length > 15) return "Enter a valid phone number";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address";
  if (String(body.address || "").length > 300) return "Address cannot exceed 300 characters";
  if (String(body.notes || "").length > 1000) return "Notes cannot exceed 1000 characters";
  if (body.status && !["Active", "Inactive"].includes(body.status)) return "Status must be Active or Inactive";
  return null;
}

export function findDuplicateCustomer(records, { phone, email }, exceptId) {
  const normalizedPhone = normalizeCustomerPhone(phone);
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return records.find(customer => !customer.isWalkIn &&
    String(customer.id) !== String(exceptId ?? "") &&
    (normalizeCustomerPhone(customer.phone) === normalizedPhone ||
      (normalizedEmail && String(customer.email || "").trim().toLowerCase() === normalizedEmail)));
}
