export default function Spinner() {
  return (
    <div className="d-flex justify-content-center py-5">
      <div className="spinner-border text-light" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
}
