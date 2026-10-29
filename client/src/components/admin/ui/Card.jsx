// client/src/components/admin/ui/Card.jsx
const Card = ({ className = '', children, ...rest }) => (
  <div className={`adm-card rounded-2xl p-5 ${className}`} {...rest}>{children}</div>
);
export default Card;
