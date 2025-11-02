FROM amazon/aws-cli:latest

RUN yum update -y && \
    yum install -y \
        postgresql17 \
        shadow-utils \
        amazon-efs-utils \
        jq && \
    # Create user and directories
    groupadd -g 1000 backupuser && \
    useradd -m -s /bin/bash -u 1000 -g 1000 backupuser && \
    mkdir -p /backups /mnt/aurora-backups /opt/aws-rds-certs /opt/backup-scripts && \
    chown backupuser:backupuser /backups /mnt/aurora-backups /opt/backup-scripts && \
    # Download SSL certificates
    curl -fsSL -o /opt/aws-rds-certs/global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem && \
    chmod 644 /opt/aws-rds-certs/global-bundle.pem && \
    yum clean all && \
    rm -rf /var/cache/yum

# Copy and set permissions in single layer
COPY scripts/ /opt/backup-scripts/
RUN chmod +x /opt/backup-scripts/*.sh && \
    chown backupuser:backupuser /opt/backup-scripts/*.sh

WORKDIR /backups

USER backupuser

ENTRYPOINT ["/opt/backup-scripts/backup-efs.sh"]
