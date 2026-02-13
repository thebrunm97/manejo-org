
import logging
from collections import Counter
from typing import Any

# Global in-memory counter
_METRICS_COUNTER = Counter()

logger = logging.getLogger(__name__)

def incr(metric: str, **labels: Any) -> None:
    """
    Increment a metric counter by 1.
    
    Args:
        metric: The name of the metric (e.g., 'record_created').
        labels: Key-value pairs associated with the metric (e.g., tipo='Plantio').
    """
    try:
        # Construct key: "metric|k1=v1|k2=v2"
        # Sort labels to ensure consistent key generation
        sorted_labels = sorted(labels.items())
        label_part = "|".join(f"{k}={v}" for k, v in sorted_labels)
        
        if label_part:
            full_key = f"{metric}|{label_part}"
        else:
            full_key = metric
            
        _METRICS_COUNTER[full_key] += 1
        current_value = _METRICS_COUNTER[full_key]
        
        # Log the metric
        logger.info(
            metric, 
            extra={
                "metric": metric, 
                "labels": labels, 
                "value": current_value
            }
        )
    except Exception as e:
        # Ensure that metric recording never breaks the application flow
        logger.error(f"Failed to record metric {metric}: {e}")
